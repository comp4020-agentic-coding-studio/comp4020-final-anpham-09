import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Presence = typeof import("../src/presence.ts");

let dbPath: string;

async function boot(): Promise<Presence> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return (await import("../src/presence.ts")) as Presence;
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("who is in which house", () => {
  it("puts someone in a house and reads them back", async () => {
    const p = await boot();
    p.enter("alice", "meeting", 1000);
    expect(p.whoIsIn("meeting", 1000)).toEqual(["alice"]);
    expect(p.whoIsIn("canberra", 1000)).toEqual([]);
  });

  it("forgets someone once the TTL has passed, rather than claiming they are still there", async () => {
    const p = await boot();
    p.enter("alice", "meeting", 1000);
    expect(p.whoIsIn("meeting", 1000 + p.PRESENCE_TTL_SECONDS - 1)).toEqual(["alice"]);
    expect(p.whoIsIn("meeting", 1000 + p.PRESENCE_TTL_SECONDS + 1)).toEqual([]);
  });

  it("keeps a person in one house at a time", async () => {
    const p = await boot();
    p.enter("alice", "meeting", 1000);
    p.enter("alice", "canberra", 1001);
    expect(p.whoIsIn("meeting", 1001)).toEqual([]);
    expect(p.whoIsIn("canberra", 1001)).toEqual(["alice"]);
  });

  it("drops someone on leave", async () => {
    const p = await boot();
    p.enter("alice", "meeting", 1000);
    p.leave("alice");
    expect(p.whoIsIn("meeting", 1000)).toEqual([]);
  });

  it("ignores a house that does not exist", async () => {
    const p = await boot();
    p.enter("alice", "treehouse", 1000);
    expect(p.whereEveryoneIs(1000)).toEqual({});
  });

  it("reports the whole village at once for the map", async () => {
    const p = await boot();
    p.enter("alice", "meeting", 1000);
    p.enter("bob", "meeting", 1000);
    p.enter("cat", "canberra", 1000);
    const everywhere = p.whereEveryoneIs(1000);
    expect(everywhere.meeting.sort()).toEqual(["alice", "bob"]);
    expect(everywhere.canberra).toEqual(["cat"]);
  });
});
