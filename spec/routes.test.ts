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
// `meeting` is left alone for Task 8's real-time tests. Do not consolidate
// these onto one house — that reintroduces the flakiness this comment is
// here to prevent. Each such test also leaves on its way out (see below), so
// the suite is safely re-runnable without waiting out the TTL.

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
      const placed = await s.post("/place", { house: "canberra", body });
      expect(placed.status).toBe(303);
      const room = await (await s.get("/house/canberra/room")).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${body}[\\s\\S]*?</li>`).exec(room);
      expect(item, "the thing just placed is not in the room").not.toBeNull();
      expect(item![0]).toContain("In the room");
    } finally {
      // Leave on the way out: presence outlives the test by the 45s TTL, and a
      // leftover witness would silently shelf the next run's placement — so
      // leave even when an assertion above has already thrown.
      await s.get("/leave");
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
      await alice.post("/place", { house: "hanoi", body: "alice put this down herself" });

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
      expect(said).toContain("two of you were there for");
    } finally {
      // Leave on the way out: see the comment on the form-POST test above —
      // this must run even when an assertion has already thrown.
      await alice.get("/leave");
      await bob.get("/leave");
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

  it("refuses to serve anything outside the images directory, or a picture that doesn't exist", async () => {
    // Joined, so an unmatched path falls through to the real 404 handler
    // rather than the join page a logged-out GET gets instead.
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "canberra" });
    const traversal = await s.get("/img/../package.json");
    expect(traversal.status).toBe(404);
    const missing = await s.get("/img/nope.jpg");
    expect(missing.status).toBe(404);
  });

  it("puts a photograph of Hanoi on the village map", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "canberra" });
    const html = await (await s.get("/")).text();
    expect(html).toContain('<img class="photo" src="/img/hanoi.jpg"');
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
});
