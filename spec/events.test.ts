import { describe, expect, it, vi } from "vitest";

// The hub knows nothing about HTTP, so it can be tested without a server.
// src/server.ts is the only place that turns a listener into an SSE write.
type Events = typeof import("../src/events.ts");

async function boot(): Promise<Events> {
  vi.resetModules();
  return (await import("../src/events.ts")) as Events;
}

describe("the event hub", () => {
  it("delivers to listeners of one house only", async () => {
    const e = await boot();
    const meeting: string[] = [];
    const canberra: string[] = [];
    e.subscribe("meeting", (p) => meeting.push(p));
    // The hub itself is a plain string-keyed map with no notion of houses; a
    // real house name is used here only so a reader can tell the two keys
    // apart at a glance, not because the hub cares which ones exist.
    e.subscribe("canberra", (p) => canberra.push(p));
    e.publish("meeting", "placed");
    expect(meeting).toEqual(["placed"]);
    expect(canberra).toEqual([]);
  });

  it("stops delivering once unsubscribed", async () => {
    const e = await boot();
    const seen: string[] = [];
    const stop = e.subscribe("meeting", (p) => seen.push(p));
    e.publish("meeting", "one");
    stop!();
    e.publish("meeting", "two");
    expect(seen).toEqual(["one"]);
    expect(e.listenerCount("meeting")).toBe(0);
  });

  it("survives an unsubscribe called twice, without orphaning a later listener", async () => {
    const e = await boot();
    const seen: string[] = [];
    const stopFirst = e.subscribe("meeting", () => {});
    stopFirst!();
    e.subscribe("meeting", (p) => seen.push(p));
    stopFirst!(); // a second cleanup for a connection that already went away
    e.publish("meeting", "placed");
    expect(seen).toEqual(["placed"]);
  });

  it("keeps publishing to the others when one listener throws", async () => {
    const e = await boot();
    const seen: string[] = [];
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    e.subscribe("meeting", () => {
      throw new Error("socket already closed");
    });
    e.subscribe("meeting", (p) => seen.push(p));
    expect(() => e.publish("meeting", "placed")).not.toThrow();
    const logCalls = logged.mock.calls.length;
    logged.mockRestore();

    expect(seen).toEqual(["placed"]);
    expect(logCalls).toBe(1);
  });

  it("publishing to a house nobody is listening to is harmless", async () => {
    const e = await boot();
    expect(() => e.publish("canberra", "placed")).not.toThrow();
    expect(e.listenerCount("canberra")).toBe(0);
  });

  it("refuses a new subscriber once the global listener cap is reached, across houses", async () => {
    // Gate 5 security audit finding: joining the village is free and
    // unlimited, so a per-identity or per-house cap would not stop one
    // visitor opening unbounded /stream connections — src/server.ts holds a
    // socket, a listener and a setInterval per connection for as long as it
    // stays open, on a 256MB machine. The cap has to be global.
    const e = await boot();
    const stops: Array<() => void> = [];
    for (let i = 0; i < e.MAX_LISTENERS; i++) {
      const stop = e.subscribe(i % 2 === 0 ? "meeting" : "canberra", () => {});
      expect(stop, `subscription ${i} should have been accepted`).not.toBeNull();
      stops.push(stop!);
    }
    expect(e.totalListenerCount()).toBe(e.MAX_LISTENERS);
    expect(e.subscribe("hanoi", () => {})).toBeNull();

    // Freeing one slot (as a closed connection's unsubscribe would) admits
    // exactly one more — the cap is a live count, not a one-time gate.
    stops[0]();
    expect(e.subscribe("hanoi", () => {})).not.toBeNull();
  });
});

describe("what a payload is allowed to be", () => {
  // Until the typing indicator, every payload was a literal written in
  // this codebase — "placed", "kept", "arrived". Typing carries a person's
  // NAME, and names are typed by people, so for the first time a payload
  // can contain whatever somebody put in the join box.
  //
  // This matters because a payload is one SSE `data:` line and a newline
  // in it is not an escape sequence: it ends the line. What follows is
  // parsed by the browser as more SSE. The failure is not a mangled event,
  // it is an EXTRA event under the control of whoever chose that name.

  it("never lets a payload carry a newline into the stream", async () => {
    const e = await boot();
    const seen: string[] = [];
    e.subscribe("meeting", (p) => seen.push(p));

    // All three line terminators SSE recognises, not just the obvious
    // one. A lone carriage return ends a line in the EventSource grammar
    // exactly as a newline does, so a sanitiser that handles only \n is
    // not a sanitiser — and that version of this test passed.
    const attempts = [
      "typing:Al\nice\n\ndata: forged",
      "typing:Al\rice\r\rdata: forged",
      "typing:Al\r\nice\r\n\r\ndata: forged",
    ];
    for (const attempt of attempts) e.publish("meeting", attempt);

    expect(seen).toHaveLength(attempts.length);
    for (const payload of seen) {
      expect(payload).not.toContain("\n");
      expect(payload).not.toContain("\r");
      // Still recognisably the event it was, so the indicator keeps
      // working for somebody with an odd name rather than silently
      // failing.
      expect(payload.startsWith("typing:")).toBe(true);
      // And written as the frame would be, it is one event, not two.
      expect(`data: ${payload}\n\n`.split(/\r\n\r\n|\r\r|\n\n/).filter(Boolean)).toHaveLength(1);
    }
  });

  it("caps a payload, because it is a notification and not a channel", async () => {
    const e = await boot();
    const seen: string[] = [];
    e.subscribe("meeting", (p) => seen.push(p));
    e.publish("meeting", "typing:" + "x".repeat(5000));
    expect(seen[0].length).toBeLessThanOrEqual(200);
  });

  it("leaves an ordinary payload exactly as it was", async () => {
    // The sanitiser must be invisible to everything that already worked.
    const e = await boot();
    const seen: string[] = [];
    e.subscribe("meeting", (p) => seen.push(p));
    for (const payload of ["placed", "kept", "arrived", "perspective", "moved", "typing:Mai"]) {
      e.publish("meeting", payload);
    }
    expect(seen).toEqual(["placed", "kept", "arrived", "perspective", "moved", "typing:Mai"]);
  });
});
