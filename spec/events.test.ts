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
    const cabin: string[] = [];
    e.subscribe("meeting", (p) => meeting.push(p));
    e.subscribe("cabin", (p) => cabin.push(p));
    e.publish("meeting", "placed");
    expect(meeting).toEqual(["placed"]);
    expect(cabin).toEqual([]);
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

  it("keeps publishing to the others when one listener throws", async () => {
    const e = await boot();
    const seen: string[] = [];
    e.subscribe("meeting", () => {
      throw new Error("socket already closed");
    });
    e.subscribe("meeting", (p) => seen.push(p));
    expect(() => e.publish("meeting", "placed")).not.toThrow();
    expect(seen).toEqual(["placed"]);
  });

  it("publishing to a house nobody is listening to is harmless", async () => {
    const e = await boot();
    expect(() => e.publish("cabin", "placed")).not.toThrow();
    expect(e.listenerCount("cabin")).toBe(0);
  });
});
