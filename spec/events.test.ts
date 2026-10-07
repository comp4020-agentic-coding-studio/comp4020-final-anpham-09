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
    stop();
    e.publish("meeting", "two");
    expect(seen).toEqual(["one"]);
    expect(e.listenerCount("meeting")).toBe(0);
  });

  it("survives an unsubscribe called twice, without orphaning a later listener", async () => {
    const e = await boot();
    const seen: string[] = [];
    const stopFirst = e.subscribe("meeting", () => {});
    stopFirst();
    e.subscribe("meeting", (p) => seen.push(p));
    stopFirst(); // a second cleanup for a connection that already went away
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
});
