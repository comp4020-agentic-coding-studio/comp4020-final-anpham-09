import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The explicit-keep rule, tested directly against a throwaway database.
// These are about what the app will and will not call a memory, not about
// HTTP. Post-crit-9: a thing on the shelf is no longer a side effect of
// presence — it requires a distinct member's written perspective AND their
// explicit "keep this together" action.
type Things = typeof import("../src/things.ts");
type People = typeof import("../src/people.ts");
type Presence = typeof import("../src/presence.ts");

let dbPath: string;

async function boot(): Promise<{ things: Things; people: People; presence: Presence }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  const people = (await import("../src/people.ts")) as People;
  people.ensurePerson("alice", "Alice", "canberra");
  people.ensurePerson("bob", "Bob", "nghe-an");
  people.ensurePerson("cat", "Cat", "hanoi");
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
    const id = things.place("meeting", "alice", "First steps", "his first steps");
    expect(typeof id).toBe("number");
    const [room] = things.inRoom("meeting", "alice");
    expect(room.title).toBe("First steps");
    expect(room.body).toBe("his first steps");
    expect(room.onShelf).toBe(false);
    expect(room.keeperNames).toEqual([]);
    expect(things.onShelf("meeting", "alice")).toEqual([]);
  });

  it("does not shelve a thing merely because someone else was in the room", async () => {
    // This is the mechanic post-crit-9 deliberately removes: presence alone
    // used to insert a keepings row for every witness. It must not anymore —
    // confirmed red against the old auto-keep code before this rewrite.
    const { things, presence } = await boot();
    presence.enter("bob", "meeting", 1000);
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    const [room] = things.inRoom("meeting", "alice");
    expect(room.onShelf).toBe(false);
    expect(room.keeperNames).toEqual([]);
    expect(things.keepTogether(id, "bob")).toBe("no-perspective");
  });

  it("shelves a thing once a distinct member writes a perspective and explicitly keeps it together", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    expect(things.addPerspective(id, "bob", "I remember this too")).toEqual(expect.any(Number));
    expect(things.keepTogether(id, "bob")).toBeNull();
    const [shelved] = things.onShelf("meeting", "alice");
    expect(shelved.onShelf).toBe(true);
    expect(shelved.placedByName).toBe("Alice");
    expect(shelved.keeperNames).toEqual(["Bob"]);
    expect(shelved.perspectives.map((p) => p.authorName)).toEqual(["Bob"]);
  });

  it("refuses to keep together without a perspective first, even for a distinct member", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    expect(things.keepTogether(id, "bob")).toBe("no-perspective");
    expect(things.onShelf("meeting", "alice")).toEqual([]);
  });

  it("never lets the placer keep their own thing, even after writing a perspective on it", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(id, "alice", "adding more of my own words");
    expect(things.keepTogether(id, "alice")).toBe("own-thing");
    const [room] = things.inRoom("meeting", "alice");
    expect(room.keeperNames).toEqual([]);
    expect(room.onShelf).toBe(false);
  });

  it("counts one person once, however many times they keep a thing together", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(id, "bob", "a perspective");
    expect(things.keepTogether(id, "bob")).toBeNull();
    expect(things.keepTogether(id, "bob")).toBe("already");
    expect(things.onShelf("meeting", "alice")[0].keeperNames).toEqual(["Bob"]);
  });

  it("accumulates keepers as distinct members each write a perspective and keep", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(id, "bob", "a perspective");
    things.addPerspective(id, "cat", "another perspective");
    expect(things.keepTogether(id, "bob")).toBeNull();
    expect(things.keepTogether(id, "cat")).toBeNull();
    expect(things.onShelf("meeting", "alice")[0].keeperNames.sort()).toEqual(["Bob", "Cat"]);
  });

  it("works asynchronously: the creator can be long gone before the second member acts", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    // No presence.enter for bob at all — this is the point: co-presence is
    // not a prerequisite, per prompt.md's "important evolution of the
    // original rule".
    things.addPerspective(id, "bob", "reading this months later");
    expect(things.keepTogether(id, "bob")).toBeNull();
    expect(things.onShelf("meeting", "alice")[0].keeperNames).toEqual(["Bob"]);
  });

  it("refuses an unknown house and a blank title or body, with a reason", async () => {
    const { things } = await boot();
    expect(things.place("meeting", "alice", "", "hello")).toBe("blank-title");
    expect(things.place("meeting", "alice", "Title", "   ")).toBe("blank-body");
    expect(things.place("treehouse", "alice", "Title", "hello")).toBe("unknown-house");
    expect(things.keepTogether(9999, "bob")).toBe("unknown-thing");
    expect(things.addPerspective(9999, "bob", "hello")).toBe("unknown-thing");
  });

  it("keeps a house's things, perspectives and shelf across a restart", async () => {
    const first = await boot();
    const id = first.things.place("meeting", "alice", "First steps", "his first steps") as number;
    first.things.addPerspective(id, "bob", "a perspective");
    first.things.keepTogether(id, "bob");

    const second = await boot();
    const [shelved] = second.things.onShelf("meeting", "alice");
    expect(shelved.title).toBe("First steps");
    expect(shelved.body).toBe("his first steps");
    expect(shelved.keeperNames).toEqual(["Bob"]);
    expect(shelved.perspectives.map((p) => p.authorName)).toEqual(["Bob"]);
  });

  it("tells the viewer which things are theirs, which they've perspectived and which they've kept", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(id, "bob", "a perspective");
    things.keepTogether(id, "bob");
    expect(things.inRoom("meeting", "alice")[0].isOwn).toBe(true);
    expect(things.inRoom("meeting", "bob")[0].isOwn).toBe(false);
    expect(things.inRoom("meeting", "bob")[0].viewerHasPerspective).toBe(true);
    expect(things.inRoom("meeting", "bob")[0].viewerHasKept).toBe(true);
    expect(things.inRoom("meeting", "cat")[0].viewerHasPerspective).toBe(false);
    expect(things.inRoom("meeting", "cat")[0].viewerHasKept).toBe(false);
  });
});
