import { expect, inject, it, describe } from "vitest";

// Presence has a real 45-second TTL and this file runs against the real dev
// server's persistent database — there is no per-test reset, and vitest runs
// spec files in parallel. Houses are therefore allocated across the suite so
// one file's witness cannot silently flip another file's "in the room" into
// "on the shelf" (spec/routes.test.ts carries the full table). This file owns
// `meeting` (the real-time stream check) and `cottage` (the witness check) —
// do not reuse `brothers` or `cabin`, which belong to spec/routes.test.ts.
// Each test that enters a house leaves on its way out, below, so the suite is
// safely re-runnable without waiting out the TTL.

const baseUrl = inject("baseUrl");

async function join(name: string, home: string): Promise<string> {
  const first = await fetch(new URL("/", baseUrl), { redirect: "manual" });
  const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0];
  await fetch(new URL("/join", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({ name, home }).toString(),
    redirect: "manual",
  });
  return cookie;
}

/** Resolves with the first `data:` line the stream sends, or rejects on the
 *  deadline. This is the brief's requirement expressed as a test. */
async function firstEvent(cookie: string, house: string, withinMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), withinMs);
  const res = await fetch(new URL(`/stream?house=${house}`, baseUrl), {
    headers: { cookie, accept: "text/event-stream" },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream closed before any event arrived");
      buffered += decoder.decode(value, { stream: true });
      const line = buffered.split("\n").find((l) => l.startsWith("data: "));
      if (line) return line.slice(6).trim();
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

describe("real-time, by the brief's definition", () => {
  it("shows one person's change in another open session in under a second", async () => {
    const alice = await join("Alice", "cabin");
    const bob = await join("Bob", "cottage");

    // Bob is in the meeting house with a stream open.
    await fetch(new URL("/house/meeting", baseUrl), { headers: { cookie: bob } });
    const waiting = firstEvent(bob, "meeting", 1000);
    // Give the subscription a moment to register before Alice acts. If this
    // test proves flaky, increase this settle — never the 1000ms deadline,
    // which is the brief's requirement, not a knob.
    await new Promise((r) => setTimeout(r, 100));

    const started = Date.now();
    await fetch(new URL("/place", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
      body: new URLSearchParams({ house: "meeting", body: "within a second" }).toString(),
      redirect: "manual",
    });

    await expect(waiting).resolves.toBe("placed");
    expect(Date.now() - started).toBeLessThan(1000);

    // Leave on the way out: presence outlives the test by the 45s TTL, and a
    // leftover witness in `meeting` would silently shelve the next run's
    // placement there, breaking the "in the room" assumption this test and
    // any future one built on `meeting` depends on.
    await fetch(new URL("/leave", baseUrl), { headers: { cookie: alice } });
    await fetch(new URL("/leave", baseUrl), { headers: { cookie: bob } });
  });

  it("puts the thing on the shelf because the other person was in the room", async () => {
    const alice = await join("Alice", "cabin");
    // Brief said `cabin` for this test's house; `cabin` is spec/routes.test.ts's
    // form-POST house, and running in parallel the two would fight over the
    // same presence row, so this uses `cottage` instead (reserved for Task 8).
    const bob = await join("Bob", "cottage");

    await fetch(new URL("/house/cottage", baseUrl), { headers: { cookie: bob } });
    // A body unique to this run, not just this test: against the real,
    // persistent dev database, a static body collides with whatever an
    // earlier run of this same test already placed, and `toContain` on the
    // whole room page would then be satisfied by that OLD row's "On the
    // shelf"/"Bob" even if THIS run's placement were never kept — exactly
    // the gap routes.test.ts's own comment warns about. Scoping to the
    // specific <li> is what makes this assertion about this placement.
    const body = `bob was here for this ${Date.now()}`;
    await fetch(new URL("/place", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
      body: new URLSearchParams({ house: "cottage", body }).toString(),
      redirect: "manual",
    });

    const room = await (await fetch(new URL("/house/cottage/room", baseUrl), { headers: { cookie: alice } })).text();
    const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${body}[\\s\\S]*?</li>`).exec(room);
    expect(item, "the thing just placed is not in the room").not.toBeNull();
    expect(item![0]).toContain("On the shelf");
    expect(item![0]).toContain("Bob");

    // Leave on the way out: see the comment on the first test.
    await fetch(new URL("/leave", baseUrl), { headers: { cookie: alice } });
    await fetch(new URL("/leave", baseUrl), { headers: { cookie: bob } });
  });
});
