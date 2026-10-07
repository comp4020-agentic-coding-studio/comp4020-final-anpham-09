import { expect, inject, it, describe } from "vitest";

// Against the RUNNING app, because these are about what a browser gets.
const baseUrl = inject("baseUrl");

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
    await s.get("/house/meeting");
    const placed = await s.post("/place", { house: "meeting", body: "a form post works" });
    expect(placed.status).toBe(303);
    const room = await (await s.get("/house/meeting/room")).text();
    expect(room).toContain("a form post works");
    expect(room).toContain("In the room");
  });

  it("explains a refusal in words rather than dropping it", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    await s.get("/house/meeting");
    const placed = await s.post("/place", { house: "meeting", body: "mine alone" });
    expect(placed.status).toBe(303);
    const id = /value="(\d+)"/.exec(await (await s.get("/house/meeting/room")).text());
    // The placer's own thing offers no button, so take it in by hand to prove
    // the server refuses the request even when the button is absent.
    const refused = await s.post("/take", { thing: id ? id[1] : "1" });
    expect(refused.status).toBe(303);
    const after = await (await s.get("/house/meeting")).text();
    expect(after).toMatch(/can't be the one who was here|put this down/);
  });

  it("answers 404 for a house that does not exist", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    expect((await s.get("/house/treehouse")).status).toBe(404);
  });
});
