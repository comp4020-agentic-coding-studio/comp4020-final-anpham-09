import { expect, inject, it, describe } from "vitest";

// Against the RUNNING app, because these are about what a browser gets.
const baseUrl = inject("baseUrl");

// Presence has a real 45-second TTL and this file runs against the real dev
// server's persistent database — there is no per-test reset. A test that
// enters a house leaves a live witness behind for up to 45 seconds, so any
// other test that places something in the SAME house within that window gets
// an unwanted extra witness and its "in the room" assertion turns into "on
// the shelf". Each presence-sensitive test below therefore gets its own
// house: the form-POST test uses `cabin`, the refusal test uses `brothers`.
// `meeting` is left alone for Task 8's real-time tests. Do not consolidate
// these onto one house — that reintroduces the flakiness this comment is
// here to prevent.

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
    const joined = await s.post("/join", { name: "Alice", home: "cabin" });
    expect(joined.status).toBe(303);
    const map = await s.get("/");
    const html = await map.text();
    expect(html).toContain("The meeting house");
    expect(html).toContain("Alice");
  });

  it("places a thing with a plain form POST, no JavaScript involved", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    await s.get("/house/cabin");
    const placed = await s.post("/place", { house: "cabin", body: "a form post works" });
    expect(placed.status).toBe(303);
    const room = await (await s.get("/house/cabin/room")).text();
    expect(room).toContain("a form post works");
    expect(room).toContain("In the room");
  });

  it("explains a refusal in words rather than dropping it", async () => {
    const alice = session();
    await alice.get("/");
    await alice.post("/join", { name: "Alice", home: "cabin" });
    await alice.get("/house/brothers");
    await alice.post("/place", { house: "brothers", body: "alice put this down herself" });

    // Only a non-placer is offered the take-it-in form, so Bob's view is where
    // the thing's id is visible at all.
    const bob = session();
    await bob.get("/");
    await bob.post("/join", { name: "Bob", home: "cottage" });
    const asBob = await (await bob.get("/house/brothers/room")).text();
    const found = /name="thing" value="(\d+)"/.exec(asBob);
    expect(found, "no take-it-in form found in Bob's view of the room").not.toBeNull();

    // Alice posts it by hand: the button is absent for her, and the server must
    // refuse the request anyway, in words.
    const refused = await alice.post("/take", { thing: found![1], house: "brothers" });
    expect(refused.status).toBe(303);
    const location = refused.headers.get("location") ?? "";
    const said = new URL(location, "http://x").searchParams.get("said") ?? "";
    expect(said).toContain("two of you were there for");
  });

  it("answers 404 for a house that does not exist", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    expect((await s.get("/house/treehouse")).status).toBe(404);
  });
});
