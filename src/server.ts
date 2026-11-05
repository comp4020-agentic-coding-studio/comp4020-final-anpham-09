import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_LISTENERS, publish, subscribe } from "./events.ts";
import { actor, logAction } from "./log.ts";
import {
  concede,
  endGame,
  freeChair,
  gameAt,
  lastSow,
  placeGame,
  play,
  sitDown,
  standUp,
  type PlaceGameRefusal,
  type PlayRefusal,
  type FreeChairRefusal,
  type SitRefusal,
} from "./games.ts";
import { houseBySlug, listHouses, type House } from "./houses.ts";
import { newToken, readCookie } from "./identity.ts";
import { clearMember, displayName, ensurePerson, getPerson, isMember, nameForPersonId, personId, setMember, type Person, type PersonRefusal } from "./people.ts";
import { codeOpens, codeProblems, householdNeedsCode, mayPlace, mayRespond } from "./members.ts";
import { accountExists, createAccount, householdOf, verifyPassword, type RegisterRefusal } from "./accounts.ts";
import { enter, leave, whereEveryoneIs, whoIsIn } from "./presence.ts";
import { esc, housePage, loginPage, mapPage, markdown, page, registerPage, roomFragment, shelfPage, tableFragment } from "./render.ts";
import {
  addPerspective,
  countsFor,
  houseOfThing,
  inRoom,
  keepTogether,
  place,
  shelfFor,
  shelfYears,
  type KeepRefusal,
  type PerspectiveRefusal,
  type PlaceRefusal,
} from "./things.ts";

const PORT = Number(process.env.PORT ?? 8080);
const COOKIE = "who";
const PING_MS = 15_000;

/** A typing ping is cheap to send and costs every other open stream in the
 *  room a message, so one keystroke-happy client could spend the whole
 *  room's bandwidth on "still typing". One per person per two seconds is
 *  far below the three seconds the bubble lives for, so the indicator
 *  never flickers, and far above what a person can usefully generate.
 *
 *  A Map keyed on token, swept when it grows: in-memory and per-process,
 *  which is correct for something that is only true for a moment anyway.
 *  There is one machine, and a restart losing this state means at worst
 *  one extra ping. */
const TYPING_EVERY_MS = 2_000;
const lastTyped = new Map<string, number>();
function allowTyping(token: string): boolean {
  const now = Date.now();
  const previous = lastTyped.get(token);
  if (previous !== undefined && now - previous < TYPING_EVERY_MS) return false;
  // Swept here rather than on a timer, so an idle server holds nothing
  // open. Anything older than the window can never refuse anybody again,
  // so dropping it loses nothing.
  //
  // The sweep only removes entries that are already stale, so in the
  // worst case — every token pinging in the same instant — it frees
  // nothing and the map is as large as the number of distinct tokens.
  // That is bounded anyway: a ping only matters to somebody with a
  // stream open, and events.ts caps those at MAX_LISTENERS. Simulated at
  // ten thousand one-shot visitors the map peaks at 201 and settles near
  // a hundred, so the cap below is the ceiling, not the usual size.
  if (lastTyped.size > MAX_LISTENERS) {
    for (const [who, when] of lastTyped) {
      if (now - when >= TYPING_EVERY_MS) lastTyped.delete(who);
    }
  }
  lastTyped.set(token, now);
  return true;
}

/** Signing in guesses a password, and nothing here used to slow that down:
 *  the key route had no throttle at all, which mattered less when a key was
 *  one of five long strings nobody could enumerate. A password somebody
 *  chose is guessable, so attempts are rationed.
 *
 *  Counted per account NAME rather than per cookie, because a cookie is
 *  free — the attacker clears it between attempts and the limit never
 *  bites. The name is what they have to keep constant to break into it.
 *
 *  Ten tries, then a minute's wait. Generous enough that a person mistyping
 *  their own password never meets it, and slow enough that guessing a weak
 *  password takes months rather than an afternoon. Same in-memory, swept-on-
 *  growth shape as allowTyping above, for the same reasons. */
const SIGNIN_TRIES = 10;
const SIGNIN_WINDOW_MS = 60_000;
const signInTries = new Map<string, { n: number; first: number }>();
function allowSignIn(name: string): boolean {
  const now = Date.now();
  const key = name.trim().toLowerCase();
  const seen = signInTries.get(key);
  if (!seen || now - seen.first >= SIGNIN_WINDOW_MS) {
    if (signInTries.size > MAX_LISTENERS) {
      for (const [who, when] of signInTries) {
        if (now - when.first >= SIGNIN_WINDOW_MS) signInTries.delete(who);
      }
    }
    signInTries.set(key, { n: 1, first: now });
    return true;
  }
  if (seen.n >= SIGNIN_TRIES) return false;
  seen.n += 1;
  return true;
}

/** A successful sign-in clears the count, so somebody who mistyped nine
 *  times and then got it right is not left one attempt from a lockout. */
function signedInOk(name: string): void {
  signInTries.delete(name.trim().toLowerCase());
}

/** Past this, the app stops reading rather than buffer the rest: a 64MB POST
 *  on a 256MB machine is how one request takes the whole thing down. No
 *  legitimate form here (a name, a house slug, a 280-char body) comes close. */
const MAX_BODY_BYTES = 64 * 1024;

// Resolved relative to this module, like the README path below — not
// process.cwd(), which differs between `pnpm dev` and the container.
const IMAGES_DIR = fileURLToPath(new URL("../img/", import.meta.url));

class BodyTooLarge extends Error {}

async function formData(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY_BYTES) throw new BodyTooLarge();
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

/** Below this, compressing costs more than it saves: the CPU and the extra
 *  header outweigh a few hundred bytes on the wire. */
const WORTH_GZIPPING = 1024;

/** Whether this request said it can take gzip. Parsed rather than
 *  string-matched, so `gzip;q=0` — a client explicitly refusing it — is
 *  honoured instead of read as a yes. */
function acceptsGzip(req: IncomingMessage): boolean {
  const header = req.headers["accept-encoding"];
  const raw = Array.isArray(header) ? header.join(",") : (header ?? "");
  for (const part of raw.split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (name !== "gzip" && name !== "*") continue;
    const q = params.find((p) => p.trim().startsWith("q="));
    return q ? Number(q.trim().slice(2)) > 0 : true;
  }
  return false;
}

/** Pages here are large on purpose — a room renders two hundred things,
 *  each with its own form — and Fly's proxy does not compress for us, so
 *  every byte rendered was a byte sent. The meeting house measured 316KB,
 *  31KB gzipped: a tenth of the bytes on the slow connection the brief
 *  names as a top-band criterion.
 *
 *  Synchronous on purpose. One shared-cpu machine with no concurrency to
 *  protect, and gzipSync on a 300KB page is a fraction of a millisecond —
 *  the async version would add a callback hop for nothing. The event
 *  stream never comes through here (see the `sse` path): compressing it
 *  would buffer it, and live updates would quietly stop. */
const html = (res: ServerResponse, status: number, body: string, cookie?: string, req?: IncomingMessage): void => {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (cookie) headers["set-cookie"] = cookie;
  const raw = Buffer.from(body, "utf8");
  if (req && raw.length >= WORTH_GZIPPING && acceptsGzip(req)) {
    const packed = gzipSync(raw);
    headers["content-encoding"] = "gzip";
    // Caches and proxies must not hand a gzipped body to a client that
    // cannot read one.
    headers.vary = "accept-encoding";
    headers["content-length"] = String(packed.length);
    res.writeHead(status, headers);
    res.end(packed);
    return;
  }
  headers["content-length"] = String(raw.length);
  res.writeHead(status, headers);
  res.end(raw);
};

const seeOther = (res: ServerResponse, to: string, cookie?: string): void => {
  const headers: Record<string, string> = { location: to };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(303, headers);
  res.end();
};

const said = (to: string, message: string): string => `${to}?said=${encodeURIComponent(message)}`;

/** A refusal has to land somewhere that can show it. An unvalidated slug from
 *  a form would redirect to a 404, and the 404 page carries no message. */
const backTo = (slug: string): string =>
  houseBySlug(slug) ? `/house/${encodeURIComponent(slug)}` : "/";

/** The pages an unjoined visitor is allowed to see the join page for: the
 *  map, the shelf, leaving, and any house — with or without one of its two
 *  live fragments, /room and /table. The fragments belong here because a
 *  stream that reconnects after the machine has slept resyncs immediately,
 *  and a visitor whose cookie expired in the meantime should meet the join
 *  page rather than a 404. Everything else is not a page the app has,
 *  whether or not the visitor has said who they are — see the comment at
 *  the gate itself. */
const isJoinablePath = (p: string): boolean =>
  p === "/" || p === "/shelf" || p === "/leave" || /^\/house\/[a-z-]+(\/room|\/table)?$/.test(p);

/** Every refusal gets words. A button that appears to do nothing teaches the
 *  user the system is broken; being told the rule teaches them the rule. */
const REFUSALS: Record<
  | PersonRefusal
  | PlaceRefusal
  | PerspectiveRefusal
  | NonNullable<KeepRefusal>
  | SitRefusal
  | PlayRefusal
  | PlaceGameRefusal
  | "not-stuck"
  | "not-seated"
  | FreeChairRefusal
  | RegisterRefusal
  | "guests-cannot-start"
  | "wrong-password"
  | "wrong-code"
  | "too-many-tries"
  | "not-signed-in",
  string
> = {
  "unknown-house": "There\'s no such house in this village.",
  // Names what a guest MAY do, not only what they may not. The old wording
  // said visitors could not keep things either, which is no longer true and
  // would have sent somebody away from the one action they came to do.
  "guests-cannot-start": "You're a guest in this house, so starting something new here is for the people who live in it. You can still write your side of anything already here and keep it together.",
  "name-taken": "Somebody already goes by that name here. Choose another.",
  "blank-password": "A password is what proves it's you. The app needs one.",
  "password-too-short": "That password is too short to be worth much — eight characters or more.",
  "wrong-password": "That name and password don't go together.",
  "wrong-code": "That isn't the code for that house. Ask whoever lives there.",
  "too-many-tries": "Too many tries just now. Wait a minute and try again.",
  "not-signed-in": "Sign in first — the app needs to know who you are.",
  "blank-name": "The app needs something to call you.",
  "blank-title": "A thing in a house needs something to call it. At the table, a line on its own is enough.",
  "blank-body": "There's nothing there to put down.",
  "unknown-thing": "That isn't here any more, so nothing was recorded.",
  "own-thing": "You put this down, so you can't be the one who keeps it together too. A memory is something two of you add to.",
  already: "You'd already kept this together. One person is one keeper, however many times they click.",
  "no-perspective": "Write a few words about this first — keeping something together starts with your own perspective on it.",
  // The game. Every one of these is a sentence for the same reason the
  // others are: being told the rule teaches it, and a board that refuses
  // silently just looks broken.
  "not-the-meeting-house": "Ô ăn quan is played at the meeting house. The three family houses are for putting things down.",
  "chairs-taken": "Both chairs are taken. You can watch — everyone at the table sees every move.",
  "already-seated": "You're already at this table. A game needs two of you.",
  "no-game": "There's no game at the table right now. Anyone can set one out.",
  "not-playing": "You're watching this game, not playing it. Only the two people in the chairs move the stones.",
  "not-seated": "You're not in either chair, so there's nothing to stand up from.",
  "empty-chair": "That chair is already free. Take it if you want to play.",
  "still-here": "They're still at the table, so their chair is theirs. A chair only frees up once somebody has actually gone.",
  "not-your-turn": "It isn't your turn yet. The board updates on its own when they've moved.",
  "not-your-pit": "That pit is on the other side of the board. You sow from your own five.",
  "empty-pit": "There's nothing in that pit to pick up. Choose one with stones in it.",
  "no-such-pit": "There's no pit there. Pick one of the ten small pits on the board.",
  "no-direction": "Choose left or right — the stones have to travel one way.",
  "must-refill": "Your five pits are empty, so your turn starts by paying five points to fill them again.",
  "game-over": "That game is over. Its score stays on the table — set out a new one to play again.",
  "game-finished": "That game is over. Its score stays on the table — set out a new one to play again.",
  // Easy to confuse with "game-finished" above, and they are opposites.
  // That one refuses a MOVE because the game is already over; this one
  // refuses KEEPING because it isn't over yet, or because it ended without
  // ever producing a result.
  "game-not-finished": "There's no result to keep yet. A game that was ended early didn't produce one, and one still being played hasn't yet.",
  "not-stuck": "Nobody is stuck — there's still a move to make, so the game is still on.",
  "already-placed": "This game is already in the room. One game is one memory, however many times it's clicked.",
};

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const message = url.searchParams.get("said");
    // A HEAD request is answered exactly like the matching GET: Node drops
    // the body for HEAD at the HTTP layer on its own, so every route below
    // just needs to be reachable by one, not rewritten for it. Without this,
    // every GET-only match above falls through to the unjoined-visitor gate,
    // which answers 200 text/html regardless of what was asked for — actively
    // wrong for something like `curl -I /img/meeting.jpg`, which would report
    // a web page instead of the image it's checking.
    const method = req.method === "HEAD" ? "GET" : req.method;

    let token = readCookie(req.headers.cookie, COOKIE);
    let setCookie: string | undefined;
    if (!token) {
      token = newToken();
      setCookie = `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
    }
    const me: Person | undefined = getPerson(token);
    // The cookie says which session; this says which person. A member is the
    // same person on every device, so the not-own trigger and the game's two
    // chairs are about humans rather than browsers.
    const who = personId(me, token);
    // The household this session's account belongs to, or null for somebody
    // signed in without one — a guest in every house.
    const myHousehold = me?.memberName ? householdOf(me.memberName) : null;
    // Two questions, not one. Starting something in a home is for the people
    // who live in it; responding to what is already there is for anybody
    // signed in, which is what lets a household of one ever reach its shelf.
    const mayStartIn = (house: House): boolean => mayPlace(house.kind, myHousehold, house.slug);
    const mayRespondHere = (): boolean => mayRespond(Boolean(me?.memberName));

    // The README is published whether or not you've said who you are.
    if (method === "GET" && path === "/readme") {
      const src = readFileSync(new URL("../README.md", import.meta.url), "utf8");
      html(res, 200, page("About — the village", `<main class="measured">${markdown(src)}</main>`, me), setCookie, req);
      return;
    }

    // Pictures are chrome, not content: they sit on the join page itself and
    // gating them behind a name would be pointless, so this is answered
    // before the join gate below, same as the README.
    // Two extensions, not one: the house photographs are still JPEG, and the
    // village and room backgrounds are WebP at three widths each, because a
    // full-bleed photograph at 1672px is a different object on a phone than
    // it is on a laptop. Digits are allowed for those widths. The extension
    // is an explicit alternation rather than a character class so a request
    // for any other format is a 404 rather than a read.
    const img = /^\/img\/([a-z0-9-]+)\.(jpg|webp)$/.exec(path);
    if (method === "GET" && img) {
      const filePath = join(IMAGES_DIR, `${img[1]}.${img[2]}`);
      // The slug is already constrained to [a-z0-9-]+ by the regex above, so
      // it cannot contain a path separator or "..", but the resolved path is
      // checked against the images directory anyway, as a second line of
      // defence against a future loosening of that pattern.
      if (!filePath.startsWith(IMAGES_DIR)) {
        res.writeHead(404).end();
        return;
      }
      try {
        const data = readFileSync(filePath);
        res.writeHead(200, {
          "content-type": img[2] === "webp" ? "image/webp" : "image/jpeg",
          "content-length": data.length,
          // An hour: long enough to matter on a slow connection, short enough
          // that a real family photo dropped in under the same filename shows
          // up the same afternoon.
          "cache-control": "public, max-age=3600",
        });
        res.end(data);
      } catch {
        // Never a 500 for a missing or unreadable file — just no picture.
        res.writeHead(404).end();
      }
      return;
    }

    // Registering: a name, a password, where you live, and the code for it.
    //
    // The code is asked for exactly here and never again. It is not a second
    // password: it decides whether this account may claim that household, and
    // after that the account carries the household on its own. Leaving it
    // blank is a real choice, not a failure — you get a real account that
    // belongs to no house and is a guest in all of them.
    if (method === "GET" && path === "/register") {
      html(res, 200, registerPage(listHouses(), message, null), setCookie, req);
      return;
    }

    if (req.method === "POST" && path === "/register") {
      const form = await formData(req);
      const name = (form.get("name") ?? "").trim();
      const password = form.get("password") ?? "";
      // "" means "no household" — the select's first option. A guest
      // everywhere is a deliberate state, so it is spelled as one.
      const wanted = (form.get("household") ?? "").trim();
      const household = wanted === "" ? null : wanted;
      const code = form.get("code") ?? "";

      // Claiming a household you have no code for is refused before the
      // account is made, so a wrong code never leaves a half-made account
      // behind for the name to be stuck on.
      if (household !== null && householdNeedsCode(household) && !codeOpens(household, code)) {
        logAction("register-refused", actor(undefined, token), { house: household, reason: "wrong-code" });
        seeOther(res, said("/register", REFUSALS["wrong-code"]), setCookie);
        return;
      }

      const refusal = createAccount(name, password, household);
      if (refusal) {
        // The reason is logged; the password never is, and neither is the
        // code. What went wrong is a fact about the attempt, not a secret.
        logAction("register-refused", actor(undefined, token), { reason: refusal });
        seeOther(res, said("/register", REFUSALS[refusal]), setCookie);
        return;
      }

      // Registering signs you in, because being made to type it again
      // immediately teaches nothing and reads as the app not having worked.
      // The account name is the trimmed one createAccount stored.
      const stored = name.trim().slice(0, 40);
      ensurePerson(token, stored, household ?? "meeting");
      setMember(token, stored);
      signedInOk(stored);
      logAction("register", actor(getPerson(token), token), { house: household });
      seeOther(res, said("/", household ? `Welcome home, ${stored}.` : `Welcome, ${stored}.`), setCookie);
      return;
    }

    if (method === "GET" && path === "/login") {
      html(res, 200, loginPage(message), setCookie, req);
      return;
    }

    if (req.method === "POST" && path === "/login") {
      const form = await formData(req);
      const name = (form.get("name") ?? "").trim();
      const password = form.get("password") ?? "";

      // Rationed before the password is checked, so a flood of guesses costs
      // the attacker a refusal rather than this box a scrypt hash each time.
      if (!allowSignIn(name)) {
        logAction("login-refused", actor(undefined, token), { reason: "too-many-tries" });
        seeOther(res, said("/login", REFUSALS["too-many-tries"]), setCookie);
        return;
      }

      if (!verifyPassword(name, password)) {
        // One message for a wrong name and a wrong password alike. Saying
        // which was wrong tells somebody guessing which names are real.
        logAction("login-refused", actor(undefined, token), { reason: "wrong-password" });
        seeOther(res, said("/login", REFUSALS["wrong-password"]), setCookie);
        return;
      }

      const household = householdOf(name);
      // The name as the account stores it, not as it was typed in the box.
      ensurePerson(token, name, household ?? "meeting");
      setMember(token, name);
      signedInOk(name);
      logAction("login", actor(getPerson(token), token), { house: household });
      seeOther(res, said("/", `Welcome back, ${name}.`), setCookie);
      return;
    }


    // Signed in means signed in to an ACCOUNT, not merely holding a cookie
    // the app has seen before. Asking `!me` here asked whether a `people`
    // row exists for this session, and every row the old /join flow left
    // behind has one with no account attached — 2148 of them on the dev
    // database, each walking straight past this gate while the nav still
    // offered them "Sign in". A fresh cookie never does, which is why no
    // test caught it and a browser did.
    if (!me?.memberName) {
      if (req.method === "POST") {
        // A POST from a signed-out tab (a stale one, say) must still be
        // told something — answering with the login page at 200 would read
        // the body never, silently.
        seeOther(res, said("/login", REFUSALS["not-signed-in"]), setCookie);
        return;
      }
      if (method === "GET" && path === "/stream") {
        // EventSource isn't a page a person reads, so there are no words to
        // give it. Answering 200 with the login page would make it retry
        // forever, every ~3 seconds, with nobody ever signing in from here.
        const headers: Record<string, string> = {};
        if (setCookie) headers["set-cookie"] = setCookie;
        res.writeHead(204, headers);
        res.end();
        return;
      }
      // A 404 is a fact about the path, not about who is asking. Someone
      // following a link to a house should be asked to sign in, not
      // 404'd — but a path the app does not recognise is not a page just
      // because nobody has signed in, and every crawler, hotlink and the
      // marker's first `curl` arrives exactly like that, with no cookie at
      // all. Without this check every unmatched path fell into the login
      // page at 200, so the app could never 404 for anyone signed out.
      if (method === "GET" && isJoinablePath(path)) {
        html(res, 200, loginPage(message), setCookie, req);
        return;
      }
      // Nothing else is a page this visitor can see without joining — the
      // same 404 the rest of the app gives, reached here directly rather
      // than falling through to routes below that assume `me` is a Person.
      html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such page.</p></main>", me), setCookie, req);
      return;
    }

    if (method === "GET" && path === "/") {
      const everywhere = whereEveryoneIs();
      const houses = listHouses().map((h) => ({
        ...h,
        hereNames: (everywhere[h.slug] ?? []).map(nameForPersonId),
        counts: countsFor(h.slug),
      }));
      html(res, 200, mapPage(houses, me, message), setCookie, req);
      return;
    }

    if (method === "GET" && path === "/shelf") {
      const filters = {
        house: (url.searchParams.get("house") ?? "").trim(),
        year: (url.searchParams.get("year") ?? "").trim(),
        q: (url.searchParams.get("q") ?? "").trim().slice(0, 120),
      };
      const houses = listHouses().map((h) => ({
        ...h,
        shelved: shelfFor(h.slug, who, { year: filters.year, q: filters.q }),
      }));
      html(res, 200, shelfPage(houses, me, message, filters, shelfYears()), setCookie, req);
      return;
    }

    if (req.method === "POST" && path === "/leave") {
      logAction("leave", actor(me, token), {});
      leave(who);
      // The account lets go of this browser, not just the browser of the
      // cookie. See clearMember: clearing only the cookie leaves the row
      // still naming an account, so replaying the old value signs you back
      // in with no password.
      clearMember(token);
      // Clearing presence but not the cookie would still resolve this token
      // to a person on the next request — the app would say "you've left"
      // and then render the map as you. Leaving means both, and landing on
      // "/" with no cookie is what makes the join page render instead.
      const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
      seeOther(res, said("/", "You've left the village. Everything you put down is still where you put it."), clearCookie);
      return;
    }

    const room = /^\/house\/([a-z-]+)\/room$/.exec(path);
    if (method === "GET" && room) {
      const house = houseBySlug(room[1]);
      if (!house) { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such house.</p></main>", me), setCookie, req); return; }
      enter(who, house.slug);
      // Computed exactly as the /house/:slug route does, so a reconnecting
      // stream's resync carries the same who-line the full page would.
      const others = whoIsIn(house.slug).filter((p) => p !== who).map(nameForPersonId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(roomFragment(others, inRoom(house.slug, who), house.slug));
      return;
    }

    // The board's counterpart to /room. Same shape, same reason: the live
    // stream swaps one fragment rather than reloading the page, and a
    // fragment route is the only way to render exactly what the full page
    // would render without duplicating the decision of what to show.
    const tableFrag = /^\/house\/([a-z-]+)\/table$/.exec(path);
    if (method === "GET" && tableFrag) {
      const house = houseBySlug(tableFrag[1]);
      if (!house || house.kind !== "meeting") { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such table.</p></main>", me), setCookie, req); return; }
      enter(who, house.slug);
      const pit = Number(url.searchParams.get("pit"));
      const others = whoIsIn(house.slug).filter((p) => p !== who).length;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        tableFragment(
          gameAt(house.slug, who),
          house.slug,
          Number.isInteger(pit) ? pit : null,
          others,
          lastSow(house.slug),
        ),
      );
      return;
    }

    const stream = method === "GET" && path === "/stream" ? url.searchParams.get("house") : null;
    if (stream) {
      const house = houseBySlug(stream);
      if (!house) { res.writeHead(404).end(); return; }
      const unsubscribe = subscribe(house.slug, (payload) => res.write(`data: ${payload}\n\n`));
      if (!unsubscribe) {
        // The 256MB machine has one open socket, one listener and one
        // setInterval per connected stream, for as long as it stays open —
        // joining is free and unlimited, so without a cap a single visitor
        // scripting enough `/stream` requests exhausts the instance. A 503
        // here is a page that stops updating live, which is this app's own
        // documented degraded mode when SSE is unavailable at all.
        res.writeHead(503, { "content-type": "text/plain", "retry-after": "30" });
        res.end("Too many open connections right now.");
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(": open\n\n");
      // An open stream is what keeps someone present: the heartbeat refreshes
      // their 45 seconds and keeps intermediaries from closing the socket.
      const ping = setInterval(() => {
        enter(who, house.slug);
        res.write(": ping\n\n");
      }, PING_MS);
      req.on("close", () => {
        clearInterval(ping);
        unsubscribe();
      });
      return;
    }

    const visit = /^\/house\/([a-z-]+)$/.exec(path);
    if (method === "GET" && visit) {
      const house = houseBySlug(visit[1]);
      if (!house) { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such house.</p></main>", me), setCookie, req); return; }
      // Arriving is what makes you present, so a reader with JavaScript off
      // still counts for the 45 seconds the app will admit to.
      enter(who, house.slug);
      const others = whoIsIn(house.slug).filter((p) => p !== who).map(nameForPersonId);
      // Which pit you have picked up is a cursor, not a fact: it lives in
      // the URL, so it is per-tab for free and nothing is written until you
      // choose a direction. A `selections` table would need a key per
      // person per tab and a TTL, and would recreate the two-tab presence
      // bug documented in src/presence.ts.
      const picked = Number(url.searchParams.get("pit"));
      html(res,
        200,
        housePage(house, me, others, inRoom(house.slug, who), message, {
          game: gameAt(house.slug, who),
          picked: Number.isInteger(picked) ? picked : null,
          replay: lastSow(house.slug),
        }),
        setCookie, req);
      publish(house.slug, "arrived");
      return;
    }

    // The game. Three POSTs, all of them plain form submissions, and the
    // pit you have picked rides on the house URL as ?pit= rather than being
    // written anywhere — see the comment on the house GET above.
    if (req.method === "POST" && path === "/game/sit") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const result = sitDown(slug, who);
      if (typeof result === "string") {
        logAction("sit-refused", actor(me, token), { house: slug, reason: result });
        seeOther(res, said(backTo(slug), REFUSALS[result]), setCookie);
        return;
      }
      // Sitting down IS being at the table — the strongest statement of
      // presence the app has. Without this, presence was only ever
      // recorded by viewing a page, so somebody who sat and then moved
      // without reloading counted as away and anybody could free their
      // chair out from under them.
      enter(who, slug);
      logAction("sit", actor(me, token), { house: slug });
      publish(slug, "sat");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    // Free a chair whose player has left. Open to anybody at the table,
    // because the person who should press it is by definition not here.
    if (req.method === "POST" && path === "/game/free") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const side = (form.get("side") ?? "").trim();
      if (side !== "bottom" && side !== "top") {
        seeOther(res, said(backTo(slug), REFUSALS["empty-chair"]), setCookie);
        return;
      }
      const refusal = freeChair(slug, side);
      if (refusal) {
        logAction("free-chair-refused", actor(me, token), { house: slug, side, reason: refusal });
        seeOther(res, said(backTo(slug), REFUSALS[refusal]), setCookie);
        return;
      }
      logAction("free-chair", actor(me, token), { house: slug, side });
      publish(slug, "stood");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/game/stand") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const refusal = standUp(slug, who);
      if (refusal) {
        seeOther(res, said(backTo(slug), REFUSALS[refusal]), setCookie);
        return;
      }
      publish(slug, "stood");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/game/move") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const pit = Number(form.get("pit"));
      const direction = (form.get("dir") ?? "").trim();
      if (!Number.isInteger(pit)) {
        seeOther(res, said(backTo(slug), REFUSALS["no-such-pit"]), setCookie);
        return;
      }
      if (direction !== "left" && direction !== "right") {
        seeOther(res, said(backTo(slug), REFUSALS["no-direction"]), setCookie);
        return;
      }
      // Playing a move is the same: you are plainly here.
      enter(who, slug);
      const refusal = play(slug, who, pit, direction);
      if (refusal) {
        seeOther(res, said(backTo(slug), REFUSALS[refusal]), setCookie);
        return;
      }
      publish(slug, "moved");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    // The typing indicator: the one thing in this app that needs
    // JavaScript, and the only route whose whole job is to say something
    // that is never written down.
    //
    // It publishes and returns 204 rather than redirecting, because it is
    // not an action a person took — it is a side effect of them typing,
    // sent by a script. A 303 would be a lie about that, and with
    // JavaScript off nothing calls this at all, which is why the feature
    // simply does not exist there rather than half-working.
    //
    // Nothing is stored. "Alice is typing" is true for three seconds and
    // then it is not, and the app has no table for things that stop being
    // true on their own — see src/presence.ts for the one exception and
    // the trouble it causes.
    if (req.method === "POST" && path === "/typing") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const house = houseBySlug(slug);
      // Silence rather than a sentence: there is no page to say it on, and
      // a refusal nobody can read is just a slower 204.
      if (!house || house.kind !== "meeting") { res.writeHead(204).end(); return; }
      if (!allowTyping(token)) { res.writeHead(204).end(); return; }
      // The name is the only user-controlled payload this app publishes.
      // events.ts sanitises it, which is where that belongs; see the note
      // on publish().
      publish(house.slug, `typing:${displayName(me)}`);
      res.writeHead(204).end();
      return;
    }

    // Ending early. Either player can, and it ends with NO result — no
    // score, no winner, nothing to keep. That asymmetry with the finished
    // game below is the point: a game somebody walked away from did not
    // produce one.
    if (req.method === "POST" && path === "/game/end") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const refusal = endGame(slug, who);
      if (refusal) {
        seeOther(res, said(backTo(slug), REFUSALS[refusal]), setCookie);
        return;
      }
      publish(slug, "ended");
      seeOther(
        res,
        said(backTo(slug), "The game's ended. Nobody won it — set out another whenever you like."),
        setCookie,
      );
      return;
    }

    // The third ending: a side that must refill and cannot afford to has
    // lost by the family's own house rules. Either player may say so,
    // because both can see it, and the board is swept for a real score.
    if (req.method === "POST" && path === "/game/concede") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const refusal = concede(slug, who);
      if (refusal) {
        seeOther(res, said(backTo(slug), REFUSALS[refusal]), setCookie);
        return;
      }
      publish(slug, "conceded");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    // Putting a finished game down in the room. It is a thing like any
    // other from here on: it reaches the shelf only when the other player
    // writes their own perspective and keeps it together.
    if (req.method === "POST" && path === "/game/place") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const result = placeGame(slug, who);
      if (typeof result === "string") {
        seeOther(res, said(backTo(slug), REFUSALS[result]), setCookie);
        return;
      }
      publish(slug, "placed");
      seeOther(
        res,
        said(backTo(slug), "The game's in the room. It reaches the shelf when they add their side of it."),
        setCookie,
      );
      return;
    }

    if (req.method === "POST" && path === "/place") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const placeHouse = houseBySlug(slug);
      if (placeHouse && !mayStartIn(placeHouse)) {
        logAction("place-refused", actor(me, token), { house: slug, reason: "guests-cannot-start" });
        seeOther(res, said(backTo(slug), REFUSALS["guests-cannot-start"]), setCookie);
        return;
      }
      const result = place(slug, who, form.get("title") ?? "", form.get("body") ?? "", form.get("event_date") ?? undefined);
      if (typeof result === "string") {
        logAction("place-refused", actor(me, token), { house: slug, reason: result });
        seeOther(res, said(backTo(slug), REFUSALS[result]), setCookie);
        return;
      }
      logAction("place", actor(me, token), { house: slug, thing: result });
      publish(slug, "placed");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/perspectives") {
      const form = await formData(req);
      const thingId = Number(form.get("thing"));
      const back = (form.get("house") ?? "").trim();
      if (!Number.isInteger(thingId)) {
        seeOther(res, said(backTo(back), REFUSALS["unknown-thing"]), setCookie);
        return;
      }
      const perspectiveHouse = houseBySlug(houseOfThing(thingId) ?? "");
      // Any house, not just your own: writing your side of somebody else's
      // thing is the whole of how anything reaches a shelf.
      if (perspectiveHouse && !mayRespondHere()) {
        logAction("perspective-refused", actor(me, token), { house: perspectiveHouse.slug, thing: thingId, reason: "guests-cannot-start" });
        seeOther(res, said(backTo(back), REFUSALS["guests-cannot-start"]), setCookie);
        return;
      }
      const refusal = addPerspective(thingId, who, form.get("body") ?? "");
      if (typeof refusal === "string") {
        logAction("perspective-refused", actor(me, token), { house: back, thing: thingId, reason: refusal });
        seeOther(res, said(backTo(back), REFUSALS[refusal]), setCookie);
        return;
      }
      logAction("perspective", actor(me, token), { house: back, thing: thingId });
      if (houseBySlug(back)) publish(back, "perspective");
      seeOther(res, backTo(back), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/take") {
      const form = await formData(req);
      const thingId = Number(form.get("thing"));
      const back = (form.get("house") ?? "").trim();
      if (!Number.isInteger(thingId)) {
        seeOther(res, said(backTo(back), REFUSALS["unknown-thing"]), setCookie);
        return;
      }
      const keepHouse = houseBySlug(houseOfThing(thingId) ?? "");
      // Same rule as a perspective, and for the same reason: An lives alone
      // in Canberra, so if only the household could keep, nothing he placed
      // at home could ever reach his own shelf.
      if (keepHouse && !mayRespondHere()) {
        logAction("keep-refused", actor(me, token), { house: keepHouse.slug, thing: thingId, reason: "guests-cannot-start" });
        seeOther(res, said(backTo(back), REFUSALS["guests-cannot-start"]), setCookie);
        return;
      }
      const refusal = keepTogether(thingId, who);
      if (refusal) {
        logAction("keep-refused", actor(me, token), { house: back, thing: thingId, reason: refusal });
        seeOther(res, said(backTo(back), REFUSALS[refusal]), setCookie);
        return;
      }
      logAction("keep", actor(me, token), { house: back, thing: thingId });
      // Only nudge the room that actually changed. A guessed destination
      // would publish to the wrong house's event stream.
      if (houseBySlug(back)) publish(back, "kept");
      seeOther(res, backTo(back), setCookie);
      return;
    }

    html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such page.</p></main>", me), setCookie, req);
  })().catch((err: unknown) => {
    if (err instanceof BodyTooLarge) {
      // Stop reading rather than buffer the rest of an oversized body —
      // destroying the socket means the client's remaining bytes are
      // dropped on the floor instead of continuing to arrive.
      if (!res.headersSent) res.writeHead(413, { "content-type": "text/plain" });
      res.end("Request body too large.");
      req.destroy();
      return;
    }
    console.error(JSON.stringify({ at: new Date().toISOString(), level: "error", err: String(err) }));
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Something went wrong.");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ at: new Date().toISOString(), level: "info", msg: "listening", port: PORT }));
  // An entry that parses but is not a hash is the worst case of the three:
  // it counts as a code to anyone reading the secret, so the house looks
  // guarded, and it can never verify, so nobody can claim it. Name the
  // houses affected — "the secret is wrong" is not actionable at 1am.
  const broken = codeProblems();
  if (broken.length > 0) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "warn",
        msg: "HOUSEHOLD_CODES has entries that are not hashes — those houses cannot be claimed with a code. Regenerate with `pnpm household-code`.",
        houses: broken,
      }),
    );
  }
  // Which houses can be claimed by anyone who finds the URL. This is the
  // setting that decides whether the app is the family's or the internet's,
  // so it is named at every boot rather than only when it is wrong.
  const unguarded = listHouses()
    .filter((h) => h.kind === "home" && !householdNeedsCode(h.slug))
    .map((h) => h.slug);
  if (unguarded.length > 0) {
    // Not a crash, but never silent: an unguarded village looks exactly like
    // a working one until a stranger registers into a bedroom.
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "warn",
        msg: "these houses have no code, so anyone who registers can claim them",
        houses: unguarded,
      }),
    );
  }
});
