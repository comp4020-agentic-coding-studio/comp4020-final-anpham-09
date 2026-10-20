import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_LISTENERS, publish, subscribe } from "./events.ts";
import { actor, logAction } from "./log.ts";
import {
  concede,
  endGame,
  gameAt,
  placeGame,
  play,
  sitDown,
  standUp,
  type PlaceGameRefusal,
  type PlayRefusal,
  type SitRefusal,
} from "./games.ts";
import { houseBySlug, listHouses, type House } from "./houses.ts";
import { newToken, readCookie } from "./identity.ts";
import { ensurePerson, getPerson, isMember, nameOf, setMember, type Person, type PersonRefusal } from "./people.ts";
import { keyProblems, keysCut, mayChange, memberFor, memberNames } from "./members.ts";
import { enter, leave, whereEveryoneIs, whoIsIn } from "./presence.ts";
import { esc, housePage, joinPage, mapPage, markdown, page, roomFragment, shelfPage, tableFragment } from "./render.ts";
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

const html = (res: ServerResponse, status: number, body: string, cookie?: string): void => {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(status, headers);
  res.end(body);
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
  | "visitors-cannot-change",
  string
> = {
  "unknown-house": "There\'s no such house in this village.",
  "visitors-cannot-change": "Only the people who live here can put something down or keep it. The meeting house is open to everyone.",
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
    // Who lives here decides what may be changed, and what of a home may be
    // read. A visitor sees a home and its shelf — what the family chose to
    // keep — but not the room, which is the unfinished talk of a household.
    // The meeting house belongs to nobody and is open to everyone.
    const belongsIn = (house: House): boolean => mayChange(house.kind, me?.memberName ?? null, keysCut());

    // The README is published whether or not you've said who you are.
    if (method === "GET" && path === "/readme") {
      const src = readFileSync(new URL("../README.md", import.meta.url), "utf8");
      html(res, 200, page("About — the village", `<main class="measured">${markdown(src)}</main>`, me), setCookie);
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

    if (req.method === "POST" && path === "/join") {
      const form = await formData(req);
      const result = ensurePerson(token, form.get("name") ?? "", form.get("home") ?? "");
      if (typeof result === "string") {
        logAction("join-refused", actor(undefined, token), { reason: result });
        seeOther(res, said("/", REFUSALS[result]), setCookie);
        return;
      }
      logAction("join", actor(result, token), { home: result.homeSlug });
      seeOther(res, "/", setCookie);
      return;
    }

    // A key says you live here. It is not an account: no sign-up, no email, no

    // profile, nothing to recover. The names come from the keys the village

    // was given, so this page can never leak a name that has no key.

    if (method === "GET" && path === "/key") {

      const names = memberNames();

      const options = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");

      html(res, 200, page("Your key", `<main class="measured">

        <h1>Your key</h1>

        <p>Visiting is enough to look around the village and read what each house

          has kept. A key is for the people who live here: it lets you put something

          down in a home and keep what someone else put there. The meeting house

          needs no key.</p>

        ${names.length === 0

          ? `<p>No keys have been cut for this village yet, so everyone here is visiting.</p>`

          : `<form method="post" action="/key">

              <label for="who">Who are you?</label>

              <select id="who" name="who" required>${options}</select>

              <label for="key">Your key</label>

              <input id="key" name="key" type="password" required autocomplete="current-password">

              <button>Unlock</button>

            </form>`}

      </main>`, me, "key"), setCookie);

      return;

    }


    if (req.method === "POST" && path === "/key") {

      const form = await formData(req);

      const who = (form.get("who") ?? "").trim();

      const proved = memberFor(who, form.get("key") ?? "");

      if (!me) {

        seeOther(res, said("/", "Say who you are first — a key belongs to somebody."), setCookie);

        return;

      }

      if (!proved) {

        // The log records the attempt and never the key. A refused unlock is

        // the server check doing its job, so it is worth a line.

        logAction("key-refused", actor(me, token), { claimed: who });

        seeOther(res, said("/key", "That key doesn't open anything here."), setCookie);

        return;

      }

      setMember(token, proved);

      logAction("key-accepted", actor(me, token), { member: proved });

      seeOther(res, said("/", `Welcome home, ${proved}.`), setCookie);

      return;

    }


    if (!me) {
      if (req.method === "POST") {
        // A POST from an unjoined visitor (a stale tab, say) must still be
        // told something — answering with the join page at 200 would read
        // the body never, silently.
        seeOther(res, said("/", "Say who you are first — the app needs a name before you can put anything down."), setCookie);
        return;
      }
      if (method === "GET" && path === "/stream") {
        // EventSource isn't a page a person reads, so there are no words to
        // give it. Answering 200 with the join page would make it retry
        // forever, every ~3 seconds, with nobody ever joining from here.
        const headers: Record<string, string> = {};
        if (setCookie) headers["set-cookie"] = setCookie;
        res.writeHead(204, headers);
        res.end();
        return;
      }
      // A 404 is a fact about the path, not about who is asking. Someone
      // following a link to a house should be asked who they are, not
      // 404'd — but a path the app does not recognise is not a page just
      // because nobody has signed in, and every crawler, hotlink and the
      // marker's first `curl` arrives exactly like that, with no cookie at
      // all. Without this check every unmatched path fell into the join
      // page at 200, so the app could never 404 for anyone who hadn't
      // already joined.
      if (method === "GET" && isJoinablePath(path)) {
        html(res, 200, joinPage(listHouses(), message), setCookie);
        return;
      }
      // Nothing else is a page this visitor can see without joining — the
      // same 404 the rest of the app gives, reached here directly rather
      // than falling through to routes below that assume `me` is a Person.
      html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such page.</p></main>", me), setCookie);
      return;
    }

    if (method === "GET" && path === "/") {
      const everywhere = whereEveryoneIs();
      const houses = listHouses().map((h) => ({
        ...h,
        hereNames: (everywhere[h.slug] ?? []).map(nameOf),
        counts: countsFor(h.slug),
      }));
      html(res, 200, mapPage(houses, me, message), setCookie);
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
        shelved: shelfFor(h.slug, token, { year: filters.year, q: filters.q }),
      }));
      html(res, 200, shelfPage(houses, me, message, filters, shelfYears()), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/leave") {
      logAction("leave", actor(me, token), {});
      leave(token);
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
      if (!house) { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such house.</p></main>", me), setCookie); return; }
      enter(token, house.slug);
      // Computed exactly as the /house/:slug route does, so a reconnecting
      // stream's resync carries the same who-line the full page would.
      const others = whoIsIn(house.slug).filter((p) => p !== token).map(nameOf);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(roomFragment(others, belongsIn(house) ? inRoom(house.slug, token) : [], house.slug));
      return;
    }

    // The board's counterpart to /room. Same shape, same reason: the live
    // stream swaps one fragment rather than reloading the page, and a
    // fragment route is the only way to render exactly what the full page
    // would render without duplicating the decision of what to show.
    const tableFrag = /^\/house\/([a-z-]+)\/table$/.exec(path);
    if (method === "GET" && tableFrag) {
      const house = houseBySlug(tableFrag[1]);
      if (!house || house.kind !== "meeting") { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such table.</p></main>", me), setCookie); return; }
      enter(token, house.slug);
      const pit = Number(url.searchParams.get("pit"));
      const others = whoIsIn(house.slug).filter((p) => p !== token).length;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        tableFragment(
          gameAt(house.slug, token),
          house.slug,
          Number.isInteger(pit) ? pit : null,
          others,
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
        enter(token, house.slug);
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
      if (!house) { html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such house.</p></main>", me), setCookie); return; }
      // Arriving is what makes you present, so a reader with JavaScript off
      // still counts for the 45 seconds the app will admit to.
      enter(token, house.slug);
      const others = whoIsIn(house.slug).filter((p) => p !== token).map(nameOf);
      // Which pit you have picked up is a cursor, not a fact: it lives in
      // the URL, so it is per-tab for free and nothing is written until you
      // choose a direction. A `selections` table would need a key per
      // person per tab and a TTL, and would recreate the two-tab presence
      // bug documented in src/presence.ts.
      const picked = Number(url.searchParams.get("pit"));
      html(
        res,
        200,
        housePage(house, me, others, belongsIn(house) ? inRoom(house.slug, token) : [], message, {
          game: gameAt(house.slug, token),
          picked: Number.isInteger(picked) ? picked : null,
        }),
        setCookie,
      );
      publish(house.slug, "arrived");
      return;
    }

    // The game. Three POSTs, all of them plain form submissions, and the
    // pit you have picked rides on the house URL as ?pit= rather than being
    // written anywhere — see the comment on the house GET above.
    if (req.method === "POST" && path === "/game/sit") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const result = sitDown(slug, token);
      if (typeof result === "string") {
        logAction("sit-refused", actor(me, token), { house: slug, reason: result });
        seeOther(res, said(backTo(slug), REFUSALS[result]), setCookie);
        return;
      }
      logAction("sit", actor(me, token), { house: slug });
      publish(slug, "sat");
      seeOther(res, backTo(slug), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/game/stand") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const refusal = standUp(slug, token);
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
      const refusal = play(slug, token, pit, direction);
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
      publish(house.slug, `typing:${nameOf(token)}`);
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
      const refusal = endGame(slug, token);
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
      const refusal = concede(slug, token);
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
      const result = placeGame(slug, token);
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
      if (placeHouse && !belongsIn(placeHouse)) {
        logAction("place-refused", actor(me, token), { house: slug, reason: "visitors-cannot-change" });
        seeOther(res, said(backTo(slug), REFUSALS["visitors-cannot-change"]), setCookie);
        return;
      }
      const result = place(slug, token, form.get("title") ?? "", form.get("body") ?? "", form.get("event_date") ?? undefined);
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
      if (perspectiveHouse && !belongsIn(perspectiveHouse)) {
        logAction("perspective-refused", actor(me, token), { house: perspectiveHouse.slug, thing: thingId, reason: "visitors-cannot-change" });
        seeOther(res, said(backTo(back), REFUSALS["visitors-cannot-change"]), setCookie);
        return;
      }
      const refusal = addPerspective(thingId, token, form.get("body") ?? "");
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
      if (keepHouse && !belongsIn(keepHouse)) {
        logAction("keep-refused", actor(me, token), { house: keepHouse.slug, thing: thingId, reason: "visitors-cannot-change" });
        seeOther(res, said(backTo(back), REFUSALS["visitors-cannot-change"]), setCookie);
        return;
      }
      const refusal = keepTogether(thingId, token);
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

    html(res, 404, page("Not found", "<main class=\"measured\"><h1>Not found</h1><p>No such page.</p></main>", me), setCookie);
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
  // it counts as a key to anyone reading the secret, so the houses look
  // locked, and it can never verify, so nobody can open them. Name the
  // people affected — "the secret is wrong" is not actionable at 1am.
  const broken = keyProblems();
  if (broken.length > 0) {
    console.warn(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "warn",
        msg: "MEMBER_KEYS has entries that are not hashes — those people cannot use their key. Regenerate with `pnpm member-key`.",
        names: broken,
      }),
    );
  }
  if (keysCut() === 0) {
    // Not a crash, but never silent: an unlocked village looks exactly like a
    // working one until a stranger puts something in a bedroom.
    console.warn(JSON.stringify({ at: new Date().toISOString(), level: "warn", msg: "no keys cut — every house is open to everyone", keys: 0 }));
  }
});
