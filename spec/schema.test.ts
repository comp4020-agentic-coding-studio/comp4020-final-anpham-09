import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Rules that live in the schema are tested against the schema, not through
// the app, because the point of putting them there is that no code path can
// forget them. src/db.ts reads DATABASE_PATH on first import, so each case
// sets the path and then imports.
type Db = typeof import("../src/db.ts");

let dbPath: string;

async function boot(): Promise<Db> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return (await import("../src/db.ts")) as Db;
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("the rules that live in the schema", () => {
  it("seeds exactly the four houses", async () => {
    const { db } = await boot();
    const slugs = db
      .prepare("SELECT slug FROM houses ORDER BY id")
      .all()
      .map((r) => (r as { slug: string }).slug);
    expect(slugs).toEqual(["cottage", "brothers", "cabin", "meeting"]);
  });

  it("refuses a keeping by whoever placed the thing", async () => {
    const { db } = await boot();
    const house = db.prepare("SELECT id FROM houses WHERE slug = 'meeting'").get() as { id: number };
    const thing = db
      .prepare("INSERT INTO things (house_id, placed_by, body) VALUES (?, ?, ?)")
      .run(house.id, "alice", "his first steps");
    expect(() =>
      db
        .prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)")
        .run(Number(thing.lastInsertRowid), "alice"),
    ).toThrow(/cannot be kept by whoever placed it/);
  });

  it("counts one person as one keeper however many rows are attempted", async () => {
    const { db } = await boot();
    const house = db.prepare("SELECT id FROM houses WHERE slug = 'meeting'").get() as { id: number };
    const thing = db
      .prepare("INSERT INTO things (house_id, placed_by, body) VALUES (?, ?, ?)")
      .run(house.id, "alice", "his first steps");
    const id = Number(thing.lastInsertRowid);
    db.prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)").run(id, "bob");
    expect(() =>
      db.prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)").run(id, "bob"),
    ).toThrow(/UNIQUE/);
  });
});
