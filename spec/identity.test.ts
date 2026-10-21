import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type People = typeof import("../src/people.ts");
type Things = typeof import("../src/things.ts");

let dbPath: string;

async function boot(): Promise<{ people: People; things: Things }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return {
    people: (await import("../src/people.ts")) as People,
    things: (await import("../src/things.ts")) as Things,
  };
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("who a request acts as", () => {
  it("makes a member the same person on every device they sign in on", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-laptop", "Mum", "nghe-an");
    people.ensurePerson("tok-phone", "Tester", "hanoi");
    people.setMember("tok-laptop", "Mum");
    people.setMember("tok-phone", "Mum");

    const laptop = people.personId(people.getPerson("tok-laptop"), "tok-laptop");
    const phone = people.personId(people.getPerson("tok-phone"), "tok-phone");

    expect(laptop).toBe("m:Mum");
    expect(phone).toBe("m:Mum");
  });

  it("keeps a visitor to their own browser, which is the honest answer", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-c", "Linh", "hanoi");
    people.ensurePerson("tok-d", "Linh", "hanoi");

    const c = people.personId(people.getPerson("tok-c"), "tok-c");
    const d = people.personId(people.getPerson("tok-d"), "tok-d");

    // Two strangers who typed the same name are not one person.
    expect(c).toBe("v:tok-c");
    expect(d).toBe("v:tok-d");
    expect(c).not.toBe(d);
  });

  it("calls a member by their account name, not the one they typed", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-x", "Tester", "hanoi");
    people.setMember("tok-x", "Mum");
    // Holding Mum's key while being displayed as Tester was how a thing
    // could be placed under an invented name.
    expect(people.displayName(people.getPerson("tok-x"))).toBe("Mum");
  });

  it("resolves a name for either kind of id, and invents none for an unknown one", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-y", "Linh", "hanoi");
    expect(people.nameForPersonId("m:Dad")).toBe("Dad");
    expect(people.nameForPersonId("v:tok-y")).toBe("Linh");
    expect(people.nameForPersonId("v:nobody")).toBe("someone");
  });
});

describe("rows written before accounts existed", () => {
  type Db = typeof import("../src/db.ts");

  it("reads them as visitors, once, without touching anything already migrated", async () => {
    vi.resetModules();
    process.env.DATABASE_PATH = dbPath;
    const { db, migrateIdentities } = (await import("../src/db.ts")) as Db;

    const house = db.prepare("SELECT id FROM houses WHERE slug = ?").get("nghe-an") as { id: number };
    // A bare token, as every row held before this change.
    db.prepare("INSERT INTO things (house_id, placed_by, title, body) VALUES (?, ?, ?, ?)")
      .run(house.id, "raw-token", "An old thing", "placed before accounts");
    // And one already migrated, which must not be prefixed twice.
    db.prepare("INSERT INTO things (house_id, placed_by, title, body) VALUES (?, ?, ?, ?)")
      .run(house.id, "m:Mum", "A new thing", "placed after");

    migrateIdentities();

    const rows = db.prepare("SELECT placed_by FROM things ORDER BY id").all() as Array<{ placed_by: string }>;
    expect(rows.map((r) => r.placed_by)).toEqual(["v:raw-token", "m:Mum"]);

    // Idempotent: running it again changes nothing.
    migrateIdentities();
    const again = db.prepare("SELECT placed_by FROM things ORDER BY id").all() as Array<{ placed_by: string }>;
    expect(again.map((r) => r.placed_by)).toEqual(["v:raw-token", "m:Mum"]);
  });
});
