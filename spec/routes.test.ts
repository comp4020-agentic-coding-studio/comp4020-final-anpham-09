import { expect, inject, it, describe } from "vitest";

// Against the RUNNING app, because these are about what a browser gets.
const baseUrl = inject("baseUrl");

// Presence has a real 45-second TTL and this file runs against the real dev
// server's persistent database — there is no per-test reset. A test that
// enters a house leaves a live witness behind for up to 45 seconds, so any
// other test that places something in the SAME house within that window gets
// an unwanted extra witness and its "in the room" assertion turns into "on
// the shelf". Each presence-sensitive test below therefore gets its own
// house: the form-POST test uses `canberra`, the refusal test uses `hanoi`.
// `meeting` is shared with Task 8's real-time tests and now also with the
// game test at the bottom of this file, because the game lives only in the
// meeting house and there is nowhere else to put it. That sharing is safe
// in a way the others are not: the game test places nothing, so no "in the
// room" assertion anywhere can be disturbed by the witness it leaves. Do
// not consolidate the rest onto one house — that reintroduces the flakiness
// this comment is here to prevent. Each such test also leaves on its way
// out (see below), so the suite is safely re-runnable without waiting out
// the TTL.

/** How many message slips the room is showing. Used to assert that
 *  something wrote NOTHING, which a length comparison on the whole page
 *  cannot do — the page carries a timestamp that moves on its own. */
const countMessages = (html: string): number =>
  (markup(html).match(/class="thing\b/g) ?? []).length;

/** A page with its inlined stylesheet removed.
 *
 *  Every page carries the whole stylesheet in a `<style>` block, and the
 *  stylesheet names the very classes the markup uses — `pit-pick`,
 *  `data-stones="0"` and so on. So `expect(html).not.toContain("pit-pick")`
 *  is always false no matter what the markup does, and
 *  `expect(html).toContain("pit-pick")` is always true. Both are vacuous,
 *  and the second kind is the dangerous one: it passes while the feature
 *  is broken.
 *
 *  This has now bitten twice — once counting phantom pits out of two CSS
 *  selectors, once asserting a control was gone when only the rule for it
 *  was present. Strip the stylesheet first and the question becomes the
 *  one actually being asked: is it in the MARKUP. */
const markup = (html: string): string => html.replace(/<style>[\s\S]*?<\/style>/g, "");

/** The position after bottom sows pit 1 to the right from the opening
 *  board, counted the way `data-stones` counts: stones in the pit, so a
 *  quan reads as one rather than as ten.
 *
 *  Sowing the same pit to the LEFT instead gives
 *  [0,6,6,6,6,0,0,6,6,6,6,2] — a different position, which is the whole
 *  reason this constant is worth asserting against. */
const SOWED_PIT_1_RIGHT = [2, 6, 6, 6, 6, 0, 0, 0, 6, 6, 6, 2];

/** The board as the page shows it: each pit carries its own count in a data
 *  attribute, so a test can read the position without a DOM parser and
 *  without the app growing a JSON endpoint it has no other use for.
 *
 *  The match is anchored on the list item rather than on the attribute
 *  alone, because the stylesheet is inlined into every page and contains
 *  data-stones="0" in two of its own selectors. An unanchored regex picks
 *  those up and prepends two phantom pits to every reading — which is
 *  exactly what the first draft of this helper did.
 *
 *  The order is the order the page lays the board out, which is not the
 *  engine's: the left quan, then the top row right-to-left (11..7), then
 *  the bottom row (1..5), then the right quan. That is deliberate in
 *  boardPanel — the ring on screen has to match the ring the stones
 *  travel — so the test reads what a person actually sees. */
function stonesOnBoard(html: string): number[] {
  // Tolerant of attributes between the class and the count — `data-pit`
  // was added later and this regex, anchored on the two being adjacent,
  // silently matched nothing and reported an empty board.
  return [...markup(html).matchAll(/<li class="pit[^"]*"[^>]*data-stones="(\d+)"/g)].map((m) =>
    Number(m[1]),
  );
}

/** A session is a cookie jar. Two of these is two people. */
function session(): {
  get: (p: string) => Promise<Response>;
  post: (p: string, body: Record<string, string>) => Promise<Response>;
  /** The cookie this session is currently sending, for a test that needs to
   *  replay it by hand after signing out. */
  cookie: () => string;
} {
  let cookie = "";
  const remember = (res: Response): Response => {
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
  const get = async (p: string): Promise<Response> =>
    remember(await fetch(new URL(p, baseUrl), { headers: cookie ? { cookie } : {}, redirect: "manual" }));
  const post = async (p: string, body: Record<string, string>): Promise<Response> =>
    remember(
      await fetch(new URL(p, baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          ...(cookie ? { cookie } : {}),
        },
        body: new URLSearchParams(body).toString(),
        redirect: "manual",
      }),
    );
  return { get, post, cookie: () => cookie };
}

type Session = ReturnType<typeof session>;

/** Every test password. Length is the only rule the app has, and a shared
 *  constant keeps the sign-in helper below able to fall back to logging in. */
const PASSWORD = "a good long passphrase";

/** Sign this session in as `name`, belonging to `household` (null for a
 *  guest everywhere).
 *
 *  Registers, and falls back to signing in when the name is already taken.
 *  That fallback is what keeps the suite re-runnable: an account name is
 *  unique for ever, so the second run of a test that registered "Alice"
 *  would otherwise be refused and every assertion after it would fail
 *  against a signed-out session. The spec runs against a persistent
 *  database with no per-test reset — see the note at the top of this file.
 *
 *  No household code is passed, which works because CI and a local dev
 *  server run with HOUSEHOLD_CODES unset, so no house requires one. A
 *  village with codes cut is exercised directly in spec/members.test.ts,
 *  where it can be done without a second server.
 *
 *  The household is part of the account NAME, not just an argument. A name
 *  is unique for ever and its household is fixed at registration, so
 *  "Bob of nghe-an" in one test and "Bob of canberra" in another would be
 *  one account belonging to whichever ran first — and the second test would
 *  quietly assert against the wrong permissions rather than fail. Encoding
 *  the house in the name makes that collision impossible instead of a thing
 *  to remember. */
async function signIn(s: Session, name: string, household: string | null): Promise<string> {
  const account = `${name} of ${household ?? "nowhere"}`;
  const made = await s.post("/register", {
    name: account,
    password: PASSWORD,
    household: household ?? "",
    code: "",
  });
  const where = made.headers.get("location") ?? "";
  const said = new URL(where, baseUrl).searchParams.get("said") ?? "";
  if (said.includes("already goes by that name")) {
    const back = await s.post("/login", { name: account, password: PASSWORD });
    const to = back.headers.get("location") ?? "";
    const msg = new URL(to, baseUrl).searchParams.get("said") ?? "";
    if (!msg.includes("Welcome back")) throw new Error(`could not sign in as ${account}: ${msg || to}`);
    return account;
  }
  if (!said.startsWith("Welcome")) throw new Error(`could not register ${account}: ${said || where}`);
  // Returned so a test asserting on a displayed name uses the name the
  // account actually has, rather than restating how it was built.
  return account;
}

/** Clear the meeting house table using the app's own routes.
 *
 *  The meeting house has exactly ONE table and every game test shares it,
 *  so a test that fails mid-way — or a person clicking around in a browser
 *  — leaves a game seated and the NEXT test's `sit` is refused as
 *  chairs-taken. That reads as a failure in whatever ran next, which has
 *  now cost three separate debugging sessions. Each test's own `finally`
 *  cannot fix it: it does not run if the failure happened before the seat
 *  was taken, and it knows nothing about state left by anybody else.
 *
 *  Freeing is only allowed for somebody who has gone, which is exactly
 *  what a leftover occupant is — so this needs no special route and no
 *  database access, just the rule the app already has.
 */
async function clearTheTable(s: Session): Promise<void> {
  for (const side of ["top", "bottom"]) {
    await s.post("/game/free", { house: "meeting", side });
  }
}

describe("what a browser gets", () => {
  it("asks a new arrival to sign in before letting them into the village", async () => {
    const s = session();
    const res = await s.get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    // The way in used to be a name box. It is a password now, so the first
    // page is the sign-in form — and it has to offer the way to make an
    // account, or somebody arriving for the first time has nowhere to go.
    expect(html).toContain("Sign in");
    expect(html).toContain('action="/login"');
    expect(html).toContain('href="/register"');
  });

  it("offers a way to make an account that actually answers", async () => {
    const s = session();
    const res = await s.get("/register");
    expect(res.status).toBe(200);
    const html = await res.text();
    // /key answered 200 from its first commit with nothing linking to it, so
    // the only way to reach it was to type the URL. Both halves are checked
    // here: the page answers, and the sign-in page above points at it.
    expect(html).toContain("What should everyone call you?");
    expect(html).toContain('action="/register"');
    expect(html).toContain("Which house is yours?");
  });

  it("lets someone join and then shows them the four houses", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    const map = await s.get("/");
    const html = await map.text();
    expect(html).toContain("The meeting house");
    expect(html).toContain("Alice");
  });

  it("places a thing with a plain form POST, no JavaScript involved", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    try {
      await s.get("/house/canberra");
      // A body unique to this run, not just this test: "contains the text" and
      // "contains In the room" are each satisfiable by some OTHER thing already
      // in canberra (e.g. a previous run's, on a warm database), so the assertions
      // below are bound to the specific <li> for the thing just placed.
      const body = `a form post works ${Date.now()}`;
      const placed = await s.post("/place", { house: "canberra", title: "A form post", body });
      expect(placed.status).toBe(303);
      const room = await (await s.get("/house/canberra/room")).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${body}[\\s\\S]*?</li>`).exec(room);
      expect(item, "the thing just placed is not in the room").not.toBeNull();
      expect(item![0]).toContain("In the room");
    } finally {
      // Leave on the way out: presence outlives the test by the 45s TTL, and a
      // leftover witness would silently shelf the next run's placement — so
      // leave even when an assertion above has already thrown.
      await s.post("/leave", {});
    }
  });

  it("explains a refusal in words rather than dropping it", async () => {
    // Alice places in HER OWN house. Starting something is now the
    // household's own right, so a Canberra account placing in Hanoi is
    // refused for a different reason than the one under test, and this
    // test would pass on the wrong refusal.
    const alice = session();
    await alice.get("/");
    await signIn(alice, "Alice", "hanoi");
    // Bob is a guest in Hanoi, which is the point: a guest may still write
    // their side and keep it, and that is what makes Alice's own attempt
    // the only thing being refused here.
    const bob = session();
    await bob.get("/");
    await signIn(bob, "Bob", "nghe-an");

    try {
      await alice.get("/house/hanoi");
      await alice.post("/place", { house: "hanoi", title: "A refusal test", body: "alice put this down herself" });

      // Only a non-placer is offered the take-it-in form, so Bob's view is where
      // the thing's id is visible at all.
      const asBob = await (await bob.get("/house/hanoi/room")).text();
      const found = /name="thing" value="(\d+)"/.exec(asBob);
      expect(found, "no take-it-in form found in Bob's view of the room").not.toBeNull();

      // Alice posts it by hand: the button is absent for her, and the server must
      // refuse the request anyway, in words.
      const refused = await alice.post("/take", { thing: found![1], house: "hanoi" });
      expect(refused.status).toBe(303);
      const location = refused.headers.get("location") ?? "";
      const said = new URL(location, "http://x").searchParams.get("said") ?? "";
      expect(said).toContain("something two of you add to");
    } finally {
      // Leave on the way out: see the comment on the form-POST test above —
      // this must run even when an assertion has already thrown.
      await alice.post("/leave", {});
      await bob.post("/leave", {});
    }
  });

  it("answers 404 for a house that does not exist", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    expect((await s.get("/house/treehouse")).status).toBe(404);
  });

  it("serves a house photograph without requiring a name", async () => {
    // A fresh fetch, no session helper at all — no cookie jar, no /join.
    const res = await fetch(new URL("/img/nghe-an.jpg", baseUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("refuses anything that isn't exactly a known slug plus .jpg, with no cookie at all", async () => {
    // `/img/../package.json` cannot test the traversal defence: a normal
    // client (fetch, a browser, curl without --path-as-is) normalises the
    // ".." out of the URL before the request is ever sent, and the
    // resulting path doesn't end in ".jpg" either way — so it never reaches
    // the route's regex regardless of how strict that regex is. The real
    // defence is the [a-z-]+ character class, and these cases exercise it:
    // uppercase, an underscore, the wrong extension, and a doubled suffix.
    for (const bad of ["/img/NGHE-AN.jpg", "/img/a_b.jpg", "/img/nghe-an.png", "/img/nghe-an.jpg.jpg"]) {
      const res = await fetch(new URL(bad, baseUrl));
      expect(res.status, `${bad} should 404`).toBe(404);
    }
    const missing = await fetch(new URL("/img/nope.jpg", baseUrl));
    expect(missing.status).toBe(404);
  });

  it("404s for an unknown path even when nobody has joined", async () => {
    // Regression test: the `!me` gate used to answer every unmatched path
    // with the join page at 200, so the app could never 404 for a visitor
    // without a cookie — which is every crawler, every hotlink, and the
    // marker's first `curl`. A 404 is a fact about the path, not about who
    // is asking.
    const res = await fetch(new URL("/definitely-not-a-page", baseUrl));
    expect(res.status).toBe(404);
  });

  it("puts a photograph of the village on the map, at three widths", async () => {
    // Was: one <img class="photo" src="/img/hanoi.jpg"> per house card. The
    // map is now a single photograph you stand inside, with the houses as
    // cards lying on top of it, so there is no per-house picture here to
    // assert any more. What replaces it is a stronger claim than the old
    // one: the scene is a real file, and it ships at three widths so a
    // phone is never sent the 1672px version. A map that silently lost its
    // photograph, or that offered only one size, still fails.
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    const html = await (await s.get("/")).text();
    expect(html).toContain('class="scene-photo"');
    for (const width of [760, 1200, 1672]) {
      expect(html).toContain(`/img/village-${width}.webp ${width}w`);
    }
    // And the file behind the smallest of them is really there.
    const res = await fetch(new URL("/img/village-760.webp", baseUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
  });

  it("answers a HEAD request for a picture with the real headers and no body", async () => {
    // `curl -I` sends HEAD, not GET — without routing HEAD to the same match
    // as GET, this falls through to the unjoined-visitor gate and reports
    // text/html for what is actually a picture.
    const res = await fetch(new URL("/img/nghe-an.jpg", baseUrl), { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(0);
  });

  it("escapes a script tag submitted as a thing's title and body, through the real place route", async () => {
    // Every ThingView field is escaped by render.ts's esc() helper, but that
    // has never been exercised through the real HTTP path a browser actually
    // uses — only markdown.test.ts's internal check of README.md fenced code
    // blocks. This posts actual markup through /place and reads it back off
    // the rendered room, the same as a visitor's browser would.
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    try {
      const marker = `xss-${Date.now()}`;
      const payload = `<script>window.${marker}=1</script>`;
      const placed = await s.post("/place", { house: "canberra", title: payload, body: `body ${payload} ${marker}` });
      expect(placed.status).toBe(303);
      const room = await (await s.get("/house/canberra/room")).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${marker}[\\s\\S]*?</li>`).exec(room);
      expect(item, "the thing just placed is not in the room").not.toBeNull();
      expect(item![0]).not.toContain("<script>");
      expect(item![0]).toContain("&lt;script&gt;");
    } finally {
      await s.post("/leave", {});
    }
  });

  it("keeps a thing together exactly once when the same person's two tabs both submit the keep action at once", async () => {
    // Two tabs sharing one cookie are two concurrent HTTP connections to the
    // same identity — not two different `session()` jars. A double-click on
    // "Keep this together", or a tab left open that replays the same POST,
    // must still land as one keeper, not a corrupted or duplicated row.
    const alice = session();
    await alice.get("/");
    await signIn(alice, "Alice", "canberra");
    const bob = session();
    await bob.get("/");
    await signIn(bob, "Bob", "canberra");

    try {
      await alice.get("/house/canberra");
      const marker = `multitab-${Date.now()}`;
      await alice.post("/place", { house: "canberra", title: "A multi-tab test", body: `thing to keep ${marker}` });

      const asBob = await (await bob.get("/house/canberra/room")).text();
      const match = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${marker}[\\s\\S]*?name="thing" value="(\\d+)"`).exec(asBob);
      expect(match, "no take-it-in form found near the thing just placed").not.toBeNull();
      const thingId = match![1];

      await bob.post("/perspectives", { thing: thingId, house: "canberra", body: "I remember this too" });

      // Two "tabs" — same cookie jar, same person — racing to submit the same
      // keep action concurrently, not one after another.
      const [first, second] = await Promise.all([
        bob.post("/take", { thing: thingId, house: "canberra" }),
        bob.post("/take", { thing: thingId, house: "canberra" }),
      ]);
      expect(first.status).toBe(303);
      expect(second.status).toBe(303);

      const room = await (await alice.get("/house/canberra/room")).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${marker}[\\s\\S]*?</li>`).exec(room);
      expect(item, "the thing is not in the room view").not.toBeNull();
      expect(item![0]).toContain("On the shelf");
      // Bob's name appears exactly once in the "kept together by" note — not
      // duplicated by the race. (It also appears once more as the perspective
      // author, which is expected and not what this assertion is about.)
      const keptLine = /Kept together by[^<]*/.exec(item![0]);
      expect(keptLine, "no kept-together note found").not.toBeNull();
      expect(keptLine![0].match(/Bob/g) ?? []).toHaveLength(1);
    } finally {
      await alice.post("/leave", {});
      await bob.post("/leave", {});
    }
  });

  it("escapes a script tag submitted as a perspective, through the real HTTP round trip to the shelf", async () => {
    const alice = session();
    await alice.get("/");
    await signIn(alice, "Alice", "canberra");
    const bob = session();
    await bob.get("/");
    await signIn(bob, "Bob", "nghe-an");

    try {
      await alice.get("/house/canberra");
      const marker = `xss-perspective-${Date.now()}`;
      const body = `a thing to perspective on ${marker}`;
      await alice.post("/place", { house: "canberra", title: "An XSS perspective test", body });

      const asBob = await (await bob.get("/house/canberra/room")).text();
      const match = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${marker}[\\s\\S]*?name="thing" value="(\\d+)"`).exec(asBob);
      expect(match, "no take-it-in form found near the thing just placed").not.toBeNull();
      const thingId = match![1];

      const payload = `<script>window.${marker}=1</script>`;
      await bob.post("/perspectives", { thing: thingId, house: "canberra", body: payload });
      await bob.post("/take", { thing: thingId, house: "canberra" });

      const shelf = await (await alice.get("/shelf")).text();
      // `class="thing ..."` rather than `class="thing"`: a shelf card now
      // carries a second class for the card-wall layout. The element is
      // still the same `li.thing` a room renders — matching the class as a
      // prefix keeps this test about escaping, which is what it is for,
      // rather than about how the shelf happens to be laid out this week.
      const item = new RegExp(`<li class="thing[^"]*">(?:(?!</li>)[\\s\\S])*?${marker}[\\s\\S]*?</li>`).exec(shelf);
      expect(item, "the kept thing is not on the shelf").not.toBeNull();
      expect(item![0]).not.toContain("<script>");
      expect(item![0]).toContain("&lt;script&gt;");
    } finally {
      await alice.post("/leave", {});
      await bob.post("/leave", {});
    }
  });

  it("does not let a cross-site GET leave the village, only a same-site POST", async () => {
    // Gate 5 security audit finding: /leave used to be a GET, and a
    // SameSite=Lax cookie is still attached to a GET reached via a plain
    // cross-site link or image load — so a link on any other page could log a
    // member out (clear presence and the cookie) just by being clicked, with
    // no form, no confirmation, and no site-of-origin check. A GET must now
    // 404 and change nothing; only the real form's POST works.
    const s = session();
    await s.get("/");
    await signIn(s, "Alice", "canberra");
    try {
      const viaGet = await s.get("/leave");
      expect(viaGet.status).toBe(404);
      // Still signed in: the map still greets Alice by name rather than
      // showing the sign-in page, proving the GET above changed nothing.
      const stillHome = await (await s.get("/")).text();
      expect(stillHome).toContain("Alice");

      const viaPost = await s.post("/leave", {});
      expect(viaPost.status).toBe(303);
      const afterLeaving = await (await s.get("/")).text();
      expect(afterLeaving).toContain('action="/login"');
    } finally {
      await s.post("/leave", {});
    }
  });

  it("plays a whole move with no JavaScript: a GET to pick, a POST to sow", async () => {
    // CLAUDE.md: "the app must work with JavaScript off". The mock's board
    // is a pick-then-choose-direction interaction, which is two steps, and
    // the first of them must not write anything — it is a GET, and a GET
    // that changed the board would break the back button and every
    // prefetcher on the internet. The shelf filters are the precedent.
    //
    // Two sessions, because a game needs two of you.
    const one = session();
    const two = session();
    try {
      await one.get("/");
      await signIn(one, "Player One", "canberra");
      await two.get("/");
      const twosName = await signIn(two, "Player Two", "hanoi");

      // A bare table: both sit, and the second sitting fills the far chair.
      // "Bare" has to be made true — see clearTheTable.
      await clearTheTable(one);
      expect((await one.post("/game/sit", { house: "meeting" })).status).toBe(303);
      expect((await two.post("/game/sit", { house: "meeting" })).status).toBe(303);

      // Step one is a link. It renders the direction buttons and a way out,
      // and it is reachable by typing the URL — no script anywhere.
      const picked = await (await one.get("/house/meeting?pit=1")).text();
      expect(picked).toContain("Which way would you like to sow?");
      expect(picked).toContain('value="left"');
      expect(picked).toContain('value="right"');
      expect(picked).toContain("Cancel selection");

      // Picking is a GET, so it must leave the board exactly as it was.
      expect(stonesOnBoard(picked)).toEqual(stonesOnBoard(await (await one.get("/house/meeting")).text()));

      // Step two is a form POST that redirects, like every other write in
      // the app. After it, it is the other player's turn.
      const moved = await one.post("/game/move", { house: "meeting", pit: "1", dir: "right" });
      expect(moved.status).toBe(303);
      expect(moved.headers.get("location")).toBe("/house/meeting");

      // Read the board back off the page. Sowing pit 1 to the RIGHT leaves
      // a position sowing LEFT could not produce, so asserting the whole
      // board makes this a test of the direction the player chose and not
      // merely of a move having happened.
      const after = await (await one.get("/house/meeting")).text();
      expect(after).toContain(`It's ${twosName}'s turn.`);
      expect(stonesOnBoard(after)).toEqual(SOWED_PIT_1_RIGHT);

      // And a move out of turn is refused in the app's own words rather
      // than by the absence of a button.
      const refused = await one.post("/game/move", { house: "meeting", pit: "2", dir: "right" });
      expect(refused.headers.get("location")).toContain("said=");
      const told = await (await one.get(refused.headers.get("location")!)).text();
      expect(told).toContain("It isn't your turn yet");
    } finally {
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("serves the board as its own fragment, so a move can arrive without a reload", async () => {
    // The board is a sibling of #room, not part of it, which means the
    // live resync has to fetch and swap both. This was found by watching:
    // the move landed in the database and the opponent's page sat there
    // showing the old position until it was reloaded by hand. A structural
    // check would not have caught it — the markup was correct, it was just
    // never asked for.
    //
    // The ?pit= selection rides along on the fragment too. Without that,
    // ANY event — including somebody else simply saying something in the
    // room — puts your stones back down in the middle of your own move.
    const one = session();
    const two = session();
    try {
      await one.get("/");
      await signIn(one, "Fragment One", "canberra");
      await two.get("/");
      await signIn(two, "Fragment Two", "hanoi");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await clearTheTable(two);
      await two.post("/game/sit", { house: "meeting" });

      const fragment = await one.get("/house/meeting/table");
      expect(fragment.status).toBe(200);
      const board = await fragment.text();
      // A fragment, not a page: no doctype, no nav, no second h1.
      expect(board).not.toContain("<!doctype");
      expect(board).not.toContain("<h1");
      expect(stonesOnBoard(board)).toHaveLength(12);

      // The same selection the full page would show, so a resync mid-move
      // hands back the board with your stones still in your hand.
      const picked = await (await one.get("/house/meeting/table?pit=1")).text();
      expect(picked).toContain("Which way would you like to sow?");
      expect(picked).toContain('value="right"');

      // After the move, the fragment alone carries the new position —
      // which is what makes a reload unnecessary.
      await one.post("/game/move", { house: "meeting", pit: "1", dir: "right" });
      const moved = await (await two.get("/house/meeting/table")).text();
      expect(stonesOnBoard(moved)).toEqual(SOWED_PIT_1_RIGHT);
      expect(moved).toContain("Fragment One");

      // There is no table in a household house, and asking for one is not
      // a quietly empty page — it is a 404, like any path the app hasn't got.
      expect((await one.get("/house/canberra/table")).status).toBe(404);
    } finally {
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("offers to keep a finished game, and offers nothing after an early end", async () => {
    // The two endings are not two names for one thing, and the interface
    // is where that has to show. A game somebody walked away from produced
    // no result, so there is nothing to put in the room — and the button
    // must be ABSENT rather than present-and-refusing, because offering an
    // action that cannot work is how an interface teaches somebody that it
    // is broken.
    const one = session();
    const two = session();
    try {
      await one.get("/");
      await signIn(one, "Ending One", "canberra");
      await two.get("/");
      await signIn(two, "Ending Two", "hanoi");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await clearTheTable(two);
      await two.post("/game/sit", { house: "meeting" });
      await one.post("/game/move", { house: "meeting", pit: "1", dir: "right" });

      // Mid-game, the only ending on offer is the one with no result, and
      // the page says so rather than leaving it to be discovered.
      const live = await (await one.get("/house/meeting")).text();
      expect(live).toContain("/game/end");
      expect(live).toContain("no score");
      expect(live).not.toContain("/game/place");

      // Either player can end it — here the one who did not start it.
      const ended = await two.post("/game/end", { house: "meeting" });
      expect(ended.status).toBe(303);
      const told = await (await two.get(ended.headers.get("location")!)).text();
      expect(told).toContain("Nobody won it");

      // And afterwards there is nothing to keep, for either of them.
      for (const who of [one, two]) {
        const after = await (await who.get("/house/meeting")).text();
        expect(after).toContain("ended early");
        expect(after).not.toContain("/game/place");
        // The final position stays on the table rather than vanishing.
        // A result line floating over the space where the board used to
        // be says less than the board does, and looks like something
        // failed to load.
        expect(stonesOnBoard(after)).toHaveLength(12);
        // But nothing on it is a control any more: the game is over.
        expect(markup(after)).not.toContain("pit-pick");
      }
      // Asking anyway is refused in words, not with a 500.
      const refused = await one.post("/game/place", { house: "meeting" });
      expect(refused.status).toBe(303);
      const why = await (await one.get(refused.headers.get("location")!)).text();
      expect(why).toContain("no result to keep");
    } finally {
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("takes a typing ping without writing anything down", async () => {
    // The one route in the app whose whole job is to say something that is
    // never stored. 204 rather than 303: it is not an action a person
    // took, it is a side effect of them typing, sent by a script. A
    // redirect would be a lie about that.
    const s1 = session();
    try {
      await s1.get("/");
      await signIn(s1, "Typist", "canberra");

      const before = markup(await (await s1.get("/house/meeting")).text());
      const ping = await s1.post("/typing", { house: "meeting" });
      expect(ping.status).toBe(204);

      // Nothing is written: the room is character-for-character what it
      // was. A typing indicator that left a trace would be a message.
      const after = markup(await (await s1.get("/house/meeting")).text());
      expect(countMessages(after)).toBe(countMessages(before));

      // Rate limited, per person. One per two seconds is far below the
      // three the bubble lives for, so a steady typist never flickers,
      // and far above what a person can usefully produce — but it stops
      // one client spending the whole room's bandwidth on keystrokes.
      // Still 204 when refused: there is no page to say it on.
      for (let i = 0; i < 5; i += 1) {
        expect((await s1.post("/typing", { house: "meeting" })).status).toBe(204);
      }

      // Not a thing you can do in a household house — nobody is talking
      // there, they are putting things down.
      expect((await s1.post("/typing", { house: "canberra" })).status).toBe(204);
      expect((await s1.post("/typing", { house: "nowhere" })).status).toBe(204);
    } finally {
      await s1.post("/leave", {});
    }
  });

  it("works with JavaScript off by simply not having a typing indicator", async () => {
    // CLAUDE.md: the app must work with JavaScript off. The honest
    // degradation for this one feature is that it does not exist — the
    // box is still there, the form still posts, and nothing is ever sent
    // or shown. That is a documented exception rather than a surprise,
    // and this is what pins it.
    const s1 = session();
    try {
      await s1.get("/");
      await signIn(s1, "No Script", "hanoi");
      const page = await (await s1.get("/house/meeting")).text();

      // The place the bubble appears is in the HTML and is EMPTY. Nothing
      // server-rendered ever fills it, so with no script it stays empty
      // for good.
      expect(markup(page)).toContain('id="typing"');
      expect(markup(page)).toMatch(/<p id="typing"[^>]*><\/p>/);

      // And the thing that actually matters still works without it: the
      // compose box is a plain form POST, not a scripted one.
      const said = await s1.post("/place", { house: "meeting", body: "typed with no script" });
      expect(said.status).toBe(303);
      expect(markup(await (await s1.get("/house/meeting")).text())).toContain("typed with no script");
    } finally {
      await s1.post("/leave", {});
    }
  });
});

describe("a household of one, which is the case this design exists for", () => {
  // An lives alone in Canberra. A thing reaches a shelf only when a SECOND
  // person writes their side of it and keeps it together, so if a guest
  // could not do that in a house that is not theirs, nothing An ever placed
  // at home could reach his own shelf. The rule the whole app is built on
  // would hold for everybody except him.
  //
  // Nothing else in the suite proves this. The unit tests exercise the two
  // permission functions directly, and the source guard reads the file; only
  // a real round trip shows a guest actually getting through the route,
  // the trigger, and onto the shelf.
  it("lets a guest corroborate a thing in a house where nobody else lives", async () => {
    const an = session();
    await an.get("/");
    const ansName = await signIn(an, "An", "canberra");

    const mum = session();
    await mum.get("/");
    const mumsName = await signIn(mum, "Mum", "nghe-an");

    try {
      // Unique per run: this database is persistent and never reset, so a
      // fixed body would match a row an earlier run left behind and the
      // assertions below would pass on the wrong thing.
      const body = `an duy called today ${Date.now()}`;
      const placed = await an.post("/place", {
        house: "canberra",
        title: "An Duy called",
        body,
      });
      expect(placed.status).toBe(303);

      // Mum is a guest in Canberra. She must be able to SEE the room:
      // you cannot write your side of something you cannot see, and the
      // room used to be hidden from everyone but the household.
      const herView = await (await mum.get("/house/canberra/room")).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${body}[\\s\\S]*?</li>`).exec(herView);
      expect(item, "a guest cannot see the room, so she can never corroborate anything in it").not.toBeNull();
      expect(item![0]).toContain("In the room");

      const thingId = /name="thing" value="(\d+)"/.exec(item![0])?.[1];
      expect(thingId, "a guest is offered no way to respond to what she can see").toBeTruthy();

      // The two halves of corroborating: her own words, then the keeping.
      const side = await mum.post("/perspectives", {
        thing: thingId!,
        house: "canberra",
        body: "I heard him on the phone, babbling away.",
      });
      expect(side.status).toBe(303);
      expect(new URL(side.headers.get("location") ?? "", baseUrl).searchParams.get("said")).toBeNull();

      const kept = await mum.post("/take", { thing: thingId!, house: "canberra" });
      expect(kept.status).toBe(303);
      const refusal = new URL(kept.headers.get("location") ?? "", baseUrl).searchParams.get("said");
      expect(refusal, `a guest was refused the keeping: ${refusal}`).toBeNull();

      // It reached the shelf, carrying BOTH names. That is the product.
      // Read the shelf CARD, not the room's slip. Three things differ and
      // each one fails as "it never reached the shelf" when it had: the
      // shelf renders `<li class="thing card-shelf">`; a card contains a
      // nested `<li class="perspective">`, so a non-greedy match to the
      // first `</li>` stops inside the card, short of the names; and the
      // stylesheet is inlined into every page and mentions these same
      // class names, so it is stripped first (see `markup` at the top of
      // this file — this has bitten twice before).
      const shelf = markup(await (await an.get("/shelf")).text());
      const cards = [...shelf.matchAll(/<li class="thing card-shelf">[\s\S]*?<\/div>\s*<\/li>/g)].map(
        (m) => m[0],
      );
      const card = cards.find((c) => c.includes(body));
      expect(card, "the thing never reached the shelf").toBeTruthy();
      // Both names on it. A thing on the shelf with one name is the thing
      // this app exists to make impossible, so this is the assertion that
      // the whole design is for.
      expect(card!).toContain(ansName);
      expect(card!).toContain(mumsName);
      expect(card!).toContain("Kept together by");
    } finally {
      await an.post("/leave", {});
      await mum.post("/leave", {});
    }
  });

  it("still refuses a guest STARTING something in a house that is not theirs", async () => {
    // The other half of the same rule, and the reason it is not simply
    // "a guest may do anything". Responding is open; starting is not.
    const mum = session();
    await mum.get("/");
    await signIn(mum, "Mum", "nghe-an");
    try {
      const refused = await mum.post("/place", {
        house: "canberra",
        title: "Not hers to start",
        body: `mum should not be able to start this ${Date.now()}`,
      });
      expect(refused.status).toBe(303);
      const said = new URL(refused.headers.get("location") ?? "", baseUrl).searchParams.get("said") ?? "";
      // Refused in words, and the words say what she MAY do — a refusal
      // that only says no teaches nothing.
      expect(said).toContain("guest in this house");
      expect(said).toContain("write your side");
    } finally {
      await mum.post("/leave", {});
    }
  });
});

describe("the sign-in wall", () => {
  // Found in a browser, not by a test: the page let me into the village
  // while the nav still offered "Sign in". The gate asked whether there was
  // a `people` row for this cookie, which is a SESSION, when the question
  // is whether that session is signed in to an ACCOUNT. Every row left by
  // the old /join flow — 2148 of them on the dev database — walked straight
  // through. A fresh cookie never does, which is why no test caught it.
  it("does not let a session that signed out back in without a password", async () => {
    // The stale row, reproduced through the app alone. Signing out clears
    // the cookie but deliberately keeps the `people` row — so replaying
    // that cookie is exactly the case the old gate waved through: a
    // session the app has seen before, belonging to no account.
    const s = session();
    await s.get("/");
    const name = await signIn(s, "Replayed", "canberra");
    // Captured BEFORE signing out, because /leave clears it.
    const held = s.cookie();
    expect(held).toBeTruthy();
    const stale = await s.post("/leave", {});
    expect(stale.status).toBe(303);

    const replayed = await fetch(new URL("/", baseUrl), {
      headers: { cookie: held },
      redirect: "manual",
    });
    const html = markup(await replayed.text());
    // Must meet the sign-in page, not the village.
    expect(html).toContain('action="/login"');
    expect(html).not.toContain(`You are <strong>${name}`);
  });

  it("refuses to write for a session that is not signed in", async () => {
    const s = session();
    await s.get("/");
    const tried = await s.post("/place", {
      house: "meeting",
      title: "",
      body: `a signed-out session should not be able to place this ${Date.now()}`,
    });
    expect(tried.status).toBe(303);
    const said = new URL(tried.headers.get("location") ?? "", baseUrl).searchParams.get("said") ?? "";
    expect(said).toContain("Sign in first");
  });
});

describe("what a guest is offered", () => {
  // Found by looking at the page, not by a test. The room's hotspot panel
  // offered "Add a note — Place on the table", anchored at #compose, to a
  // guest who has no composer: a link to a form that is not on the page,
  // for the one action the house refuses them. Every HTML assertion passed
  // while it was there, because none of them knew to look.
  it("offers a guest no shortcut to a composer they do not have", async () => {
    const guest = session();
    await guest.get("/");
    await signIn(guest, "Hotspot Guest", "nghe-an");
    try {
      const page = markup(await (await guest.get("/house/canberra")).text());
      // The composer really is absent...
      expect(page).not.toContain('id="compose"');
      // ...so nothing may point at it.
      expect(page).not.toContain('href="#compose"');
      expect(page).not.toContain("Add a note");
      // What they MAY do is still offered.
      expect(page).toContain("Add your perspective");
    } finally {
      await guest.post("/leave", {});
    }
  });

  it("still offers the household their own composer and its shortcut", async () => {
    // The other half: removing the hotspot for everybody would be a
    // different bug, and one this test would have caught.
    const host = session();
    await host.get("/");
    await signIn(host, "Hotspot Host", "canberra");
    try {
      const page = markup(await (await host.get("/house/canberra")).text());
      expect(page).toContain('id="compose"');
      expect(page).toContain('href="#compose"');
      expect(page).toContain("Add a note");
    } finally {
      await host.post("/leave", {});
    }
  });
});

describe("a table nobody can get back to", () => {
  // The photographed bug, end to end: "2 seated · 1 here", both chairs
  // held, no control anywhere that frees one. The model test in
  // spec/games.test.ts proves freeChair's rules; this proves a person can
  // actually reach it — the last fix like this had a route that answered
  // 200 from its first commit with nothing linking to it.
  it("offers a way to free the chair of somebody who has gone", async () => {
    const one = session();
    await one.get("/");
    await signIn(one, "Seat One", "canberra");
    const two = session();
    await two.get("/");
    const twosName = await signIn(two, "Seat Two", "hanoi");

    try {
      await one.get("/house/meeting");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await two.get("/house/meeting");
      await clearTheTable(two);
      await two.post("/game/sit", { house: "meeting" });

      // Seat Two leaves the village entirely: presence gone, chair still held.
      await two.post("/leave", {});

      const table = markup(await (await one.get("/house/meeting")).text());
      expect(table).toContain(twosName);
      // The control exists, names the side, and is reachable by somebody
      // who is NOT the person in that chair.
      expect(table).toContain('action="/game/free"');
      expect(table).toContain("Free this chair");

      const freed = await one.post("/game/free", { house: "meeting", side: "top" });
      expect(freed.status).toBe(303);
      const said = new URL(freed.headers.get("location") ?? "", baseUrl).searchParams.get("said");
      expect(said, `freeing the chair was refused: ${said}`).toBeNull();

      // And now the table has a seat in it again.
      const after = markup(await (await one.get("/house/meeting")).text());
      expect(after).toContain("Sit down");
    } finally {
      // The house field matters: /game/stand without it refuses and the
      // table stays occupied for whatever runs next. The meeting house has
      // exactly one table and every game test shares it.
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("refuses to free the chair of somebody who is still at the table", async () => {
    const one = session();
    await one.get("/");
    await signIn(one, "Present One", "canberra");
    const two = session();
    await two.get("/");
    await signIn(two, "Present Two", "hanoi");

    try {
      await one.get("/house/meeting");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await two.get("/house/meeting");
      await clearTheTable(two);
      await two.post("/game/sit", { house: "meeting" });

      // Both are here, so neither chair may be taken from its occupant.
      const refused = await one.post("/game/free", { house: "meeting", side: "top" });
      expect(refused.status).toBe(303);
      const said = new URL(refused.headers.get("location") ?? "", baseUrl).searchParams.get("said") ?? "";
      expect(said).toContain("still at the table");
    } finally {
      // Top stands first: standing the bottom player while somebody holds
      // the top chair hands them the table rather than clearing it.
      await two.post("/game/stand", { house: "meeting" });
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });
});

describe("the table reads as a conversation", () => {
  // The composer used to sit in the side panel, across the page from what
  // had been said. A chat puts it under the messages, where you are
  // looking. These assert the STRUCTURE that makes that true, since the
  // stylesheet is inlined into every page and asserting on class names
  // alone would pass on the CSS text — see `markup` at the top of this file.
  it("puts the composer inside the conversation, under the messages", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Chat Shape", "canberra");
    try {
      const page = markup(await (await s.get("/house/meeting")).text());
      const room = page.indexOf('<div id="room">');
      const composer = page.indexOf('<div class="composer">');
      const collection = page.indexOf('class="room-collection conversation"');

      expect(collection, "the meeting house is not marked as a conversation").toBeGreaterThan(-1);
      expect(composer, "no composer under the messages").toBeGreaterThan(-1);
      // Order is the assertion: messages first, composer after, and both
      // inside the collection rather than off in the panel.
      expect(collection).toBeLessThan(room);
      expect(room).toBeLessThan(composer);
      expect(page.indexOf('class="panel-stack"')).toBeGreaterThan(composer);
    } finally {
      await s.post("/leave", {});
    }
  });

  it("leaves every other house's composer where it was", async () => {
    // The other three houses are not conversations: you are filing a thing
    // there, not answering somebody, and the composer stays in the panel.
    const s = session();
    await s.get("/");
    await signIn(s, "Chat Shape Home", "canberra");
    try {
      const page = markup(await (await s.get("/house/canberra")).text());
      expect(page).not.toContain("room-collection conversation");
      expect(page).not.toContain('<div class="composer">');
      // Still has one, just in the panel: the composer comes after the
      // panel opens, not inside the message list.
      expect(page).toContain('id="compose"');
      expect(page.indexOf('class="panel-stack"')).toBeLessThan(page.indexOf('id="compose"'));
    } finally {
      await s.post("/leave", {});
    }
  });

  it("marks a run of messages from one person so they group", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Grouper", "canberra");
    try {
      const stamp = Date.now();
      await s.post("/place", { house: "meeting", title: "", body: `grouping one ${stamp}` });
      await s.post("/place", { house: "meeting", title: "", body: `grouping two ${stamp}` });
      const page = markup(await (await s.get("/house/meeting")).text());

      // The second of two consecutive messages from one person is marked,
      // which is what hides the repeated monogram and name.
      const second = page.indexOf(`grouping two ${stamp}`);
      expect(second).toBeGreaterThan(-1);
      const itsRow = page.lastIndexOf('<li class="thing thread-msg"', second);
      expect(page.slice(itsRow, second)).toContain('data-same-sender="true"');
    } finally {
      await s.post("/leave", {});
    }
  });
});

describe("reaching the composer with a keyboard", () => {
  // The brief's top band for the artefact is keyboard, resize
  // mid-interaction and a slow connection. Measured in a real browser, the
  // message box at the table was tab stop 606 of 609: every message
  // contributes a disclosure control, so reaching the box meant tabbing
  // past all two hundred of them. The form worked; it was simply
  // unreachable by the input method the brief names first.
  it("offers a skip link straight to the message box, before the messages", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Keyboard User", "canberra");
    try {
      await s.post("/place", { house: "meeting", title: "", body: `keyboard test ${Date.now()}` });
      const page = markup(await (await s.get("/house/meeting")).text());

      const skip = page.indexOf('href="#body"');
      const room = page.indexOf('<div id="room">');
      const box = page.indexOf('id="body"');

      expect(skip, "no way to reach the composer without tabbing the whole thread").toBeGreaterThan(-1);
      // Before the messages, or it is just another stop after them.
      expect(skip).toBeLessThan(room);
      expect(room).toBeLessThan(box);
    } finally {
      await s.post("/leave", {});
    }
  });

  it("does not add one to a house that has no conversation to skip", async () => {
    // The other houses list a handful of things and put the composer in
    // the panel; a skip link there would be noise in the tab order, which
    // is the same problem pointed the other way.
    const s = session();
    await s.get("/");
    await signIn(s, "Keyboard Home", "canberra");
    try {
      const page = markup(await (await s.get("/house/canberra")).text());
      expect(page).not.toContain('href="#body"');
    } finally {
      await s.post("/leave", {});
    }
  });
});

describe("what a slow connection has to download", () => {
  // The brief's top band for the artefact names a slow connection. Pages
  // here are large — the meeting house renders two hundred messages, each
  // with its own form — and nothing was compressed: Fly's proxy does not
  // do it for us, so every byte rendered was a byte sent. Measured at
  // 316KB for that page, 31KB gzipped.
  it("compresses a page when the browser says it can take it", async () => {
    const s = session();
    await s.get("/");
    await signIn(s, "Slow Line", "canberra");
    try {
      const res = await fetch(new URL("/house/meeting", baseUrl), {
        headers: { cookie: s.cookie(), "accept-encoding": "gzip" },
        redirect: "manual",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBe("gzip");
      // `fetch` decodes transparently, so what arrives is still the page.
      const html = await res.text();
      expect(html).toContain("Family chat");
      expect(html).toContain('id="body"');
    } finally {
      await s.post("/leave", {});
    }
  });

  it("sends plain bytes to a client that did not ask for gzip", async () => {
    // Compression is an offer, never an assumption: a client that omits
    // the header gets exactly what it would have got before.
    const s = session();
    await s.get("/");
    await signIn(s, "Plain Line", "canberra");
    try {
      const res = await fetch(new URL("/house/meeting", baseUrl), {
        headers: { cookie: s.cookie(), "accept-encoding": "identity" },
        redirect: "manual",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBeNull();
      expect(await res.text()).toContain("Family chat");
    } finally {
      await s.post("/leave", {});
    }
  });

  it("honours a client that names gzip only to refuse it", async () => {
    // `gzip;q=0` means "I know what gzip is and I do not want it". A
    // substring check for "gzip" reads that as a yes and sends a body the
    // client said it cannot take. Worth its own test because the plain
    // `identity` case above passes whether or not the q-value is parsed:
    // that string contains no "gzip" token to be confused by. Caught by
    // breaking the parser and watching nothing go red.
    const s = session();
    await s.get("/");
    await signIn(s, "Refuses Gzip", "canberra");
    try {
      const res = await fetch(new URL("/house/meeting", baseUrl), {
        headers: { cookie: s.cookie(), "accept-encoding": "gzip;q=0, identity" },
        redirect: "manual",
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-encoding")).toBeNull();
    } finally {
      await s.post("/leave", {});
    }
  });

  it("never compresses the event stream, which must not be buffered", async () => {
    // SSE is the one response that must leave the server the instant it is
    // written. Compressing it buffers it, and live updates — the brief's
    // own one-second requirement — silently stop arriving.
    const s = session();
    await s.get("/");
    await signIn(s, "Stream Line", "canberra");
    const controller = new AbortController();
    try {
      const res = await fetch(new URL("/stream?house=meeting", baseUrl), {
        headers: { cookie: s.cookie(), "accept-encoding": "gzip" },
        signal: controller.signal,
      });
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      expect(res.headers.get("content-encoding")).toBeNull();
    } finally {
      controller.abort();
      await s.post("/leave", {});
    }
  });
});

describe("sowing, stone by stone", () => {
  // CLAUDE.md's second JavaScript exception, and the shape it has to keep:
  // the feature is ABSENT without a script, never broken. The board the
  // server sends is already the true position, so the only thing a reader
  // with scripts blocked loses is the travelling.
  it("sends the true final board, so the position is right with no script at all", async () => {
    const one = session();
    const two = session();
    try {
      await one.get("/");
      await signIn(one, "Sowing One", "canberra");
      await two.get("/");
      await signIn(two, "Sowing Two", "hanoi");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await two.post("/game/sit", { house: "meeting" });
      await one.post("/game/move", { house: "meeting", pit: "1", dir: "right" });

      const page = markup(await (await one.get("/house/meeting")).text());
      // The opening move from a fresh board empties pit 1 and relays, so
      // the position is NOT the starting one. If the server were leaving
      // the board for the script to update, this would still read 5.
      const pit1 = /<li class="pit[^"]*" data-pit="1"[^>]*data-stones="(\d+)"/.exec(page);
      expect(pit1, "pit 1 is not in the markup").not.toBeNull();
      expect(pit1![1]).toBe("0");
    } finally {
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("carries the move it just played, one beat per stone", async () => {
    const one = session();
    const two = session();
    try {
      await one.get("/");
      await signIn(one, "Beat One", "canberra");
      await two.get("/");
      await signIn(two, "Beat Two", "hanoi");
      await clearTheTable(one);
      await one.post("/game/sit", { house: "meeting" });
      await two.post("/game/sit", { house: "meeting" });
      await one.post("/game/move", { house: "meeting", pit: "1", dir: "right" });

      const page = await (await one.get("/house/meeting")).text();
      const found = /<script type="application\/json" id="sow-replay">([\s\S]*?)<\/script>/.exec(page);
      expect(found, "no replay on the page after a move").not.toBeNull();
      const replay = JSON.parse(found![1]!);
      expect(replay.pit).toBe(1);
      expect(replay.direction).toBe("right");
      // The hand lifts, then stones land one at a time.
      expect(replay.drops[0]).toMatchObject({ kind: "pick", at: 1 });
      expect(replay.drops.filter((d: { kind: string }) => d.kind === "drop").length).toBeGreaterThan(1);
      // Inert data, not executable: a <script type="application/json"> is
      // never run, and is simply ignored when scripts are blocked.
      expect(page).toContain('type="application/json"');
    } finally {
      await one.post("/game/stand", { house: "meeting" });
      await one.post("/leave", {});
      await two.post("/leave", {});
    }
  });

  it("gives every pit a stable id, since position in the rows is not identity", async () => {
    // The top row renders right-to-left so the board matches the ring the
    // stones travel, so "third li" is not "pit 3". The animation targets
    // pits by id; without these it would light the wrong ones.
    const s = session();
    await s.get("/");
    await signIn(s, "Pit Ids", "canberra");
    try {
      const page = markup(await (await s.get("/house/meeting")).text());
      const ids = [...page.matchAll(/data-pit="(\d+)"/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
      expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    } finally {
      await s.post("/leave", {});
    }
  });
});
