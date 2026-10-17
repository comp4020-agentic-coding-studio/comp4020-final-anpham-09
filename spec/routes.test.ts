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
  return [...markup(html).matchAll(/<li class="pit[^"]*" data-stones="(\d+)"/g)].map((m) =>
    Number(m[1]),
  );
}

/** A session is a cookie jar. Two of these is two people. */
function session(): { get: (p: string) => Promise<Response>; post: (p: string, body: Record<string, string>) => Promise<Response> } {
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
  return { get, post };
}

describe("what a browser gets", () => {
  it("asks a new arrival for a name before letting them into the village", async () => {
    const s = session();
    const res = await s.get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("What should everyone call you?");
  });

  it("lets someone join and then shows them the four houses", async () => {
    const s = session();
    await s.get("/");
    const joined = await s.post("/join", { name: "Alice", home: "canberra" });
    expect(joined.status).toBe(303);
    const map = await s.get("/");
    const html = await map.text();
    expect(html).toContain("The meeting house");
    expect(html).toContain("Alice");
  });

  it("places a thing with a plain form POST, no JavaScript involved", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "canberra" });
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
    const alice = session();
    await alice.get("/");
    await alice.post("/join", { name: "Alice", home: "canberra" });
    const bob = session();
    await bob.get("/");
    await bob.post("/join", { name: "Bob", home: "nghe-an" });

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
    await s.post("/join", { name: "Alice", home: "canberra" });
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
    await s.post("/join", { name: "Alice", home: "canberra" });
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
    await s.post("/join", { name: "Alice", home: "canberra" });
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
    await alice.post("/join", { name: "Alice", home: "canberra" });
    const bob = session();
    await bob.get("/");
    await bob.post("/join", { name: "Bob", home: "canberra" });

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
    await alice.post("/join", { name: "Alice", home: "canberra" });
    const bob = session();
    await bob.get("/");
    await bob.post("/join", { name: "Bob", home: "nghe-an" });

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
    await s.post("/join", { name: "Alice", home: "canberra" });
    try {
      const viaGet = await s.get("/leave");
      expect(viaGet.status).toBe(404);
      // Still joined: the map still greets Alice by name rather than showing
      // the join page, proving the GET above changed nothing.
      const stillHome = await (await s.get("/")).text();
      expect(stillHome).toContain("Alice");

      const viaPost = await s.post("/leave", {});
      expect(viaPost.status).toBe(303);
      const afterLeaving = await (await s.get("/")).text();
      expect(afterLeaving).toContain("What should everyone call you?");
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
      await one.post("/join", { name: "Player One", home: "canberra" });
      await two.get("/");
      await two.post("/join", { name: "Player Two", home: "hanoi" });

      // A bare table: both sit, and the second sitting fills the far chair.
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
      expect(after).toContain("It's Player Two's turn.");
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
      await one.post("/join", { name: "Fragment One", home: "canberra" });
      await two.get("/");
      await two.post("/join", { name: "Fragment Two", home: "hanoi" });
      await one.post("/game/sit", { house: "meeting" });
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
      await one.post("/join", { name: "Ending One", home: "canberra" });
      await two.get("/");
      await two.post("/join", { name: "Ending Two", home: "hanoi" });
      await one.post("/game/sit", { house: "meeting" });
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
      await s1.post("/join", { name: "Typist", home: "canberra" });

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
      await s1.post("/join", { name: "No Script", home: "hanoi" });
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
