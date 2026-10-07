import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The witness rule, tested directly against a throwaway database. These are
// about what the app will and will not call a memory, not about HTTP.
type Things = typeof import("../src/things.ts");
type People = typeof import("../src/people.ts");
type Presence = typeof import("../src/presence.ts");

let dbPath: string;

async function boot(): Promise<{ things: Things; people: People; presence: Presence }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  const people = (await import("../src/people.ts")) as People;
  people.ensurePerson("alice", "Alice", "cabin");
  people.ensurePerson("bob", "Bob", "cottage");
  people.ensurePerson("cat", "Cat", "brothers");
  return {
    things: (await import("../src/things.ts")) as Things,
    people,
    presence: (await import("../src/presence.ts")) as Presence,
  };
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("what the app will and won't call a memory", () => {
  it("leaves a thing placed alone in the room, not on the shelf", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000);
    expect(typeof id).toBe("number");
    const [room] = things.inRoom("meeting", "alice");
    expect(room.body).toBe("his first steps");
    expect(room.onShelf).toBe(false);
    expect(room.keeperNames).toEqual([]);
    expect(things.onShelf("meeting", "alice")).toEqual([]);
  });

  it("puts a thing on the shelf at once when someone else was in the room", async () => {
    const { things, presence } = await boot();
    presence.enter("bob", "meeting", 1000);
    things.place("meeting", "alice", "his first steps", 1000);
    const [shelved] = things.onShelf("meeting", "alice");
    expect(shelved.onShelf).toBe(true);
    expect(shelved.placedByName).toBe("Alice");
    expect(shelved.keeperNames).toEqual(["Bob"]);
  });

  it("never counts the placer as a keeper, even when they are the only one in the room", async () => {
    const { things, presence } = await boot();
    presence.enter("alice", "meeting", 1000);
    things.place("meeting", "alice", "his first steps", 1000);
    const [room] = things.inRoom("meeting", "alice");
    expect(room.keeperNames).toEqual([]);
    expect(room.onShelf).toBe(false);
  });

  it("lets someone who arrives later take a thing in", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000) as number;
    expect(things.takeIn(id, "bob")).toBeNull();
    const [shelved] = things.onShelf("meeting", "alice");
    expect(shelved.keeperNames).toEqual(["Bob"]);
  });

  it("refuses, with a reason, to let the placer take in their own thing", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000) as number;
    expect(things.takeIn(id, "alice")).toBe("own-thing");
    expect(things.onShelf("meeting", "alice")).toEqual([]);
  });

  it("counts one person once, however many times they take a thing in", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000) as number;
    expect(things.takeIn(id, "bob")).toBeNull();
    expect(things.takeIn(id, "bob")).toBe("already");
    expect(things.onShelf("meeting", "alice")[0].keeperNames).toEqual(["Bob"]);
  });

  it("accumulates keepers as people arrive one after another", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000) as number;
    expect(things.takeIn(id, "bob")).toBeNull();
    expect(things.takeIn(id, "cat")).toBeNull();
    expect(things.onShelf("meeting", "alice")[0].keeperNames.sort()).toEqual(["Bob", "Cat"]);
  });

  it("records every name, when more than one person was there", async () => {
    const { things, presence } = await boot();
    presence.enter("bob", "meeting", 1000);
    presence.enter("cat", "meeting", 1000);
    things.place("meeting", "alice", "his first steps", 1000);
    expect(things.onShelf("meeting", "alice")[0].keeperNames.sort()).toEqual(["Bob", "Cat"]);
  });

  it("refuses an unknown thing and a blank body, with a reason", async () => {
    const { things } = await boot();
    expect(things.place("meeting", "alice", "   ")).toBe("blank-body");
    expect(things.place("treehouse", "alice", "hello")).toBe("unknown-house");
    expect(things.takeIn(9999, "bob")).toBe("unknown-thing");
  });

  it("keeps a house's things and its shelf across a restart", async () => {
    const first = await boot();
    first.presence.enter("bob", "meeting", 1000);
    first.things.place("meeting", "alice", "his first steps", 1000);

    const second = await boot();
    const [shelved] = second.things.onShelf("meeting", "alice");
    expect(shelved.body).toBe("his first steps");
    expect(shelved.keeperNames).toEqual(["Bob"]);
  });

  it("tells the viewer which things are theirs and which they have kept", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "his first steps", 1000) as number;
    things.takeIn(id, "bob");
    expect(things.inRoom("meeting", "alice")[0].isOwn).toBe(true);
    expect(things.inRoom("meeting", "bob")[0].isOwn).toBe(false);
    expect(things.inRoom("meeting", "bob")[0].viewerHasKept).toBe(true);
    expect(things.inRoom("meeting", "cat")[0].viewerHasKept).toBe(false);
  });
});
