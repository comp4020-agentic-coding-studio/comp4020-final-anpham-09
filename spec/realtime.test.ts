import { expect, inject, it, describe } from "vitest";

// Presence has a real 45-second TTL and this file runs against the real dev
// server's persistent database — there is no per-test reset, and vitest runs
// spec files in parallel. Houses are therefore allocated across the suite so
// one file's witness cannot silently flip another file's "in the room" into
// "on the shelf" (spec/routes.test.ts carries the full table). This file owns
// `meeting` (the real-time stream check) and `nghe-an` (the witness check) —
// do not reuse `hanoi` or `canberra`, which belong to spec/routes.test.ts.
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
  // The abort timer starts here, before the 100ms settle the caller waits out
  // below, so the ceiling measured from `started` (set after the settle) is
  // actually ~withinMs - 100 (~900ms, not 1000ms) — stricter than the brief's
  // one second, never looser.
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

/** Like `firstEvent`, but waits for an event that MATCHES rather than for
 *  the first one to arrive.
 *
 *  `meeting` is shared with spec/routes.test.ts, which vitest runs in
 *  parallel with this file, and its game tests publish "sat", "moved" and
 *  "placed" to the same house. `firstEvent` is still right for the test
 *  above — any event proves delivery, which is what the brief asks about —
 *  but a test that asserts on the CONTENT of a payload must not assert on
 *  somebody else's.
 *
 *  Found by the suite failing about half the time it was run as a whole
 *  while passing every time the file was run alone. The payload it got was
 *  "sat".
 */
async function firstEventMatching(
  cookie: string,
  house: string,
  matches: (payload: string) => boolean,
  withinMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), withinMs);
  const res = await fetch(new URL(`/stream?house=${house}`, baseUrl), {
    headers: { cookie, accept: "text/event-stream" },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  const seen: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream closed; saw ${JSON.stringify(seen)}`);
      buffered += decoder.decode(value, { stream: true });
      // Consume whole lines, so a payload split across two chunks is not
      // read twice or half-read.
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        seen.push(payload);
        if (matches(payload)) return payload;
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

describe("real-time, by the brief's definition", () => {
  it("shows one person's change in another open session in under a second", async () => {
    const alice = await join("Alice", "canberra");
    const bob = await join("Bob", "nghe-an");

    try {
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
        body: new URLSearchParams({ house: "meeting", title: "Within a second", body: "within a second" }).toString(),
        redirect: "manual",
      });

      await expect(waiting).resolves.toBe("placed");
      expect(Date.now() - started).toBeLessThan(1000);
    } finally {
      // Presence outlives the test by the 45s TTL, and a leftover witness in
      // `meeting` would silently shelve the next run's placement there — so
      // leave even when an assertion above has already thrown.
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: alice } });
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: bob } });
    }
  });

  it("does not put a thing on the shelf merely because the other person was in the room", async () => {
    // Post-crit-9: presence has no write-side effect at all any more. This
    // replaces the old auto-keep-from-presence assertion this test used to
    // make — confirmed red against the unmodified `src/things.ts` before this
    // rewrite, since that code used to insert a keeping for every witness.
    const alice = await join("Alice", "canberra");
    // Brief said `canberra` for this test's house; `canberra` is spec/routes.test.ts's
    // form-POST house, and running in parallel the two would fight over the
    // same presence row, so this uses `nghe-an` instead (reserved for Task 8).
    const bob = await join("Bob", "nghe-an");

    try {
      await fetch(new URL("/house/nghe-an", baseUrl), { headers: { cookie: bob } });
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
        body: new URLSearchParams({ house: "nghe-an", title: "Bob was here", body }).toString(),
        redirect: "manual",
      });

      const room = await (await fetch(new URL("/house/nghe-an/room", baseUrl), { headers: { cookie: alice } })).text();
      const item = new RegExp(`<li class="thing">(?:(?!</li>)[\\s\\S])*?${body}[\\s\\S]*?</li>`).exec(room);
      expect(item, "the thing just placed is not in the room").not.toBeNull();
      expect(item![0]).toContain("In the room");
      expect(item![0]).not.toContain("On the shelf");
    } finally {
      // Leave on the way out: see the comment on the first test. Only Alice
      // and Bob entered a house here, so only they need to leave.
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: alice } });
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: bob } });
    }
  });
});

describe("the typing indicator, over the real stream", () => {
  it("arrives as one frame the client can tell apart from a change", async () => {
    // The whole design rests on one thing: the client can distinguish a
    // typing event from every other event by its payload alone, because
    // typing must NOT trigger a resync. Refetching the room on every
    // keystroke would be a request per character from everybody watching,
    // and it would wipe a half-written message out of the box the moment
    // somebody else started typing.
    //
    // So the payload format is a contract, and this is where it is
    // checked over a real socket rather than in the renderer's string.
    const alice = await join("Alice", "canberra");
    const bob = await join("Bob", "nghe-an");
    try {
      await fetch(new URL("/house/meeting", baseUrl), { headers: { cookie: bob } });
      const waiting = firstEventMatching(bob, "meeting", (p) => p.startsWith("typing:"), 2000);
      await new Promise((r) => setTimeout(r, 100));

      await fetch(new URL("/typing", baseUrl), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
        body: new URLSearchParams({ house: "meeting" }).toString(),
      });

      const payload = await waiting;
      // The prefix the client branches on, and the name after it.
      expect(payload.startsWith("typing:")).toBe(true);
      expect(payload.slice(7)).toBe("Alice");
      // One line. If a name could carry a newline this would be two
      // events, the second of them forged — see spec/events.test.ts.
      expect(payload).not.toContain("\n");
      expect(payload).not.toContain("\r");
    } finally {
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: alice } });
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: bob } });
    }
  });

  it("keeps every other event resyncing, which typing must not break", async () => {
    // The contract has two halves and this is the other one: nothing that
    // worked before may start looking like a typing event. If "placed"
    // ever gained that prefix the room would stop updating entirely, and
    // the failure would be silent — a page that quietly never changes.
    const alice = await join("Alice", "canberra");
    const bob = await join("Bob", "nghe-an");
    try {
      await fetch(new URL("/house/meeting", baseUrl), { headers: { cookie: bob } });
      // "placed" specifically, not just "the next event": another file
      // may be publishing to this house at the same moment, and the
      // claim being made here is about what /place sends.
      const waiting = firstEventMatching(bob, "meeting", (p) => p === "placed", 2000);
      await new Promise((r) => setTimeout(r, 100));

      await fetch(new URL("/place", baseUrl), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
        body: new URLSearchParams({ house: "meeting", body: "not a typing event" }).toString(),
      });

      const payload = await waiting;
      expect(payload.startsWith("typing:")).toBe(false);
    } finally {
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: alice } });
      await fetch(new URL("/leave", baseUrl), { method: "POST", headers: { cookie: bob } });
    }
  });
});
