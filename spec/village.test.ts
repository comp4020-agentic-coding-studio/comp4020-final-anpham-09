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
    expect(things.place("meeting", "alice", "Title", "   ")).toBe("blank-body");
    expect(things.place("treehouse", "alice", "Title", "hello")).toBe("unknown-house");
    expect(things.keepTogether(9999, "bob")).toBe("unknown-thing");
    expect(things.addPerspective(9999, "bob", "hello")).toBe("unknown-thing");
  });

  // Replaces a line in the test above that asserted
  // place("meeting", …, "", "hello") returned "blank-title". That rule
  // changed: the meeting house is a conversation, and a remark at the table
  // has no title. Both halves are asserted here on purpose — the first is
  // the one that matters, because without it this change quietly becomes
  // "titles are optional everywhere" and the shelf fills with kept memories
  // that have nothing to call them.
  it("asks for a title in a house, and not at the table", async () => {
    const { things } = await boot();
    expect(things.place("canberra", "alice", "", "a thing in a house")).toBe("blank-title");
    expect(typeof things.place("meeting", "alice", "", "a line at the table")).toBe("number");
  });

  // A body is still required at the table: the whole content of a remark is
  // its body, so a blank one is nothing at all.
  //
  // The second assertion is the one with teeth, and it is here because the
  // first one has none. `place()` now looks the house up before judging the
  // title, so the two checks have an order, and the meeting-house case
  // cannot detect it — the title check never fires there, so a blank body
  // answers "blank-body" whichever way round the checks go. Only a
  // household house, where both checks are live, pins the order down.
  // Found by breaking the order and watching this test stay green.
  it("asks about the body before the title, when both are blank", async () => {
    const { things } = await boot();
    expect(things.place("meeting", "alice", "", "   ")).toBe("blank-body");
    expect(things.place("canberra", "alice", "", "   ")).toBe("blank-body");
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

  it("never double-counts a keeper under concurrent keepTogether calls for the same person", async () => {
    // Two "tabs" racing to submit the same keep action. better-sqlite3 is
    // synchronous, so there is no real interleaving inside a single process —
    // but this still exercises the exact code path two real concurrent HTTP
    // requests would hit: the UNIQUE(thing_id, person) constraint and the
    // "already" catch in keepTogether, not just the sequential case the
    // "counts one person once" test above covers with calls one at a time.
    const { things } = await boot();
    const id = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(id, "bob", "a perspective");
    const results = await Promise.all([
      Promise.resolve(things.keepTogether(id, "bob")),
      Promise.resolve(things.keepTogether(id, "bob")),
      Promise.resolve(things.keepTogether(id, "bob")),
    ]);
    expect(results.filter((r) => r === null)).toHaveLength(1);
    expect(results.filter((r) => r === "already")).toHaveLength(2);
    expect(things.onShelf("meeting", "alice")[0].keeperNames).toEqual(["Bob"]);
  });
});

describe("the shelf's filters", () => {
  it("narrows by the year something was first kept, offering only years that actually have a kept thing", async () => {
    const { things } = await boot();
    const first = things.place("meeting", "alice", "First steps", "his first steps") as number;
    things.addPerspective(first, "bob", "a perspective");
    things.keepTogether(first, "bob");

    expect(things.shelfYears()).toEqual([new Date().getFullYear().toString()]);

    const matching = things.shelfFor("meeting", "alice", { year: new Date().getFullYear().toString() });
    expect(matching.map((t) => t.id)).toEqual([first]);

    const nonMatching = things.shelfFor("meeting", "alice", { year: "1999" });
    expect(nonMatching).toEqual([]);
  });

  it("does not offer a year for a thing that is only in the room, never kept", async () => {
    const { things } = await boot();
    things.place("meeting", "alice", "Unkept", "nobody has kept this yet");
    expect(things.shelfYears()).toEqual([]);
  });

  it("searches title, story and perspective text, case-insensitively", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "The big dinner", "everyone came home for it") as number;
    things.addPerspective(id, "bob", "I remember the noodles especially");
    things.keepTogether(id, "bob");

    const other = things.place("meeting", "alice", "A quiet evening", "nothing much happened") as number;
    things.addPerspective(other, "cat", "just a normal night");
    things.keepTogether(other, "cat");

    expect(things.shelfFor("meeting", "alice", { q: "DINNER" }).map((t) => t.id)).toEqual([id]);
    expect(things.shelfFor("meeting", "alice", { q: "noodles" }).map((t) => t.id)).toEqual([id]);
    expect(things.shelfFor("meeting", "alice", { q: "quiet" }).map((t) => t.id)).toEqual([other]);
    expect(things.shelfFor("meeting", "alice", { q: "nonexistent-word" })).toEqual([]);
  });

  it("combines year and keyword filters, and returns everything kept when no filter is given", async () => {
    const { things } = await boot();
    const id = things.place("meeting", "alice", "The big dinner", "everyone came home for it") as number;
    things.addPerspective(id, "bob", "a perspective");
    things.keepTogether(id, "bob");

    const thisYear = new Date().getFullYear().toString();
    expect(things.shelfFor("meeting", "alice", {}).map((t) => t.id)).toEqual([id]);
    expect(things.shelfFor("meeting", "alice", { year: thisYear, q: "dinner" }).map((t) => t.id)).toEqual([id]);
    expect(things.shelfFor("meeting", "alice", { year: thisYear, q: "nonexistent" })).toEqual([]);
    expect(things.shelfFor("meeting", "alice", { year: "1999", q: "dinner" })).toEqual([]);
  });

  it("never surfaces a thing that is still only in the room, whatever the filters", async () => {
    const { things } = await boot();
    things.place("meeting", "alice", "Unkept thing", "still just in the room");
    expect(things.shelfFor("meeting", "alice", {})).toEqual([]);
    expect(things.shelfFor("meeting", "alice", { q: "unkept" })).toEqual([]);
  });
});
