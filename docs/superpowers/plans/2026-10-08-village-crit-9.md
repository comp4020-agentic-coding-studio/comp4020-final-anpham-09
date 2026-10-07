# The village — crit 9 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimum village that carries the whole argument — four houses, live presence, place a note in a room, and the witness rule that puts it on the shelf — deployed by the crit-9 cutoff.

**Architecture:** Replace Corroborated's two tables with five (`houses`, `people`, `things`, `keepings`, `presence`) in the same SQLite file. The self-keeping ban is a `BEFORE INSERT` trigger because SQLite cannot express a cross-table `CHECK`. "On the shelf" is derived from the existence of a `keepings` row, never stored, so it cannot drift. Pages are server-rendered and every action is a form POST; a small `EventSource` client swaps in a re-rendered room fragment for live updates, so the app works unchanged with JavaScript off.

**Tech Stack:** Node 24 running TypeScript directly (no build step), `better-sqlite3`, server-sent events, `vitest` against the running app. All already in the repo.

## Global Constraints

- **Deadline:** crit-9 cutoff is Wednesday 14 October 2026, 13:30 Australia/Canberra (group Liuru). Deployed and live by then.
- **Imports name the file, extension included** — `./db.ts`, not `./db`. Node runs the TypeScript directly; `tsc --noEmit` is the typecheck and never emits.
- **`/data` is the only durable storage.** `DATABASE_PATH` defaults to `/data/app.db` in the image.
- **The app must work with JavaScript off.** Every action is a form POST followed by a 303 redirect. Live updating is the only thing JS adds.
- **Interactive targets are at least 44×44px.** Colour comes from custom properties only; no literal hex in a rule body. Status is carried in text, never by colour alone. One `h1` per page.
- **Never show a thing on the shelf with only one name on it.** Never delete or expire anything anyone placed. Never say "saw" — the app knows who *was here*. Never let someone keep their own thing by any path.
- **A test that has never been seen to fail is not evidence.** Every new test gets broken once, confirmed red, then restored.
- **Never commit `.data/` or `.idea/`.** The Fly token lives in gitignored `mise.local.toml`.
- **Presence TTL is 45 seconds**, named once as `PRESENCE_TTL_SECONDS` and imported everywhere else.
- **House slugs are exactly** `cottage`, `brothers`, `cabin`, `meeting`.

Run the app with `pnpm dev` (listens on 8080). Run checks with `pnpm check` **while the app is running** — `spec/global-setup.ts` waits for `APP_URL` (default `http://localhost:8080`) and fails with "nothing is answering" if it isn't up.

---

### Task 1: Schema — the five tables and the trigger

**Files:**
- Modify: `src/db.ts` (append new tables; leave the `claims`/`corroborations` tables in place for now so the existing app still typechecks and runs)
- Create: `spec/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `db` (unchanged export from `src/db.ts`), and the tables `houses(id, slug, name, kind)`, `people(token, name, home_slug, created_at)`, `things(id, house_id, placed_by, body, created_at)`, `keepings(id, thing_id, person, created_at)`, `presence(person, house_id, last_seen)`

- [ ] **Step 1: Write the failing test**

Create `spec/schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Start the app in another terminal (`pnpm dev`), then:

Run: `pnpm vitest run spec/schema.test.ts`
Expected: FAIL — "no such table: houses"

- [ ] **Step 3: Add the schema**

Append to `src/db.ts`, below the existing `db.exec(...)` block:

```ts
// The village. Four places, the people in them, the things people put down,
// and who else was in the room when they did. "On the shelf" is not a column:
// a thing is kept iff a keepings row exists for it, so the state cannot drift
// away from the fact that produced it.
db.exec(`
  CREATE TABLE IF NOT EXISTS houses (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT    NOT NULL UNIQUE,
    name TEXT    NOT NULL,
    kind TEXT    NOT NULL CHECK (kind IN ('home', 'meeting'))
  );

  CREATE TABLE IF NOT EXISTS people (
    token      TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    home_slug  TEXT NOT NULL REFERENCES houses(slug),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS things (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id   INTEGER NOT NULL REFERENCES houses(id),
    placed_by  TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- UNIQUE(thing_id, person) is "one person is one keeper" in the schema
  -- rather than in a code path that can be forgotten.
  CREATE TABLE IF NOT EXISTS keepings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    thing_id   INTEGER NOT NULL REFERENCES things(id),
    person     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (thing_id, person)
  );

  -- SQLite cannot express this as a CHECK, because the constraint reads a
  -- column in another table. A trigger is the only place it can live that no
  -- code path can route around.
  CREATE TRIGGER IF NOT EXISTS keepings_not_own
  BEFORE INSERT ON keepings
  FOR EACH ROW
  WHEN NEW.person = (SELECT placed_by FROM things WHERE id = NEW.thing_id)
  BEGIN
    SELECT RAISE(ABORT, 'a thing cannot be kept by whoever placed it');
  END;

  -- The only mutable table in the app. Presence is live state, not something
  -- anyone put down, so it is overwritten rather than appended.
  CREATE TABLE IF NOT EXISTS presence (
    person    TEXT    PRIMARY KEY,
    house_id  INTEGER NOT NULL REFERENCES houses(id),
    last_seen INTEGER NOT NULL
  );
`);

// Houses are fixed furniture, not user-created content: the village is this
// family's three homes and the place they meet, and nothing in the app adds
// a fifth. Seeded once; renaming later is an UPDATE, not a new row.
const SEED: Array<[slug: string, name: string, kind: "home" | "meeting"]> = [
  ["cottage", "The cottage", "home"],
  ["brothers", "The brothers' house", "home"],
  ["cabin", "The cabin", "home"],
  ["meeting", "The meeting house", "meeting"],
];
const seed = db.prepare("INSERT OR IGNORE INTO houses (slug, name, kind) VALUES (?, ?, ?)");
for (const [slug, name, kind] of SEED) seed.run(slug, name, kind);
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run spec/schema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Prove the trigger test can fail**

Temporarily change the trigger's `WHEN` line to `WHEN 0`, re-run, and confirm the "refuses a keeping by whoever placed the thing" case goes red. Restore the line and confirm green again. This is required — an untested guard is not evidence.

- [ ] **Step 6: Commit**

```bash
git add src/db.ts spec/schema.test.ts
git commit -m "feat: village schema — four houses, things, keepings, and the trigger that bans self-keeping"
```

---

### Task 2: Houses and people

**Files:**
- Create: `src/houses.ts`
- Create: `src/people.ts`
- Modify: `src/identity.ts` (comment only — the pseudonym generator is deleted in Task 7, together with its last caller, so that every task leaves the repo typechecking)
- Create: `spec/people.test.ts`

**Interfaces:**
- Consumes: `db` from `src/db.ts`
- Produces:
  - `src/houses.ts`: `interface House { id: number; slug: string; name: string; kind: "home" | "meeting" }`, `listHouses(): House[]`, `houseBySlug(slug: string): House | undefined`
  - `src/people.ts`: `interface Person { token: string; name: string; homeSlug: string }`, `ensurePerson(token: string, name: string, homeSlug: string): Person | "unknown-house" | "blank-name"`, `getPerson(token: string): Person | undefined`, `nameOf(token: string): string`
  - `src/identity.ts`: `newToken(): string`, `readCookie(header: string | undefined, key: string): string | undefined`

- [ ] **Step 1: Write the failing test**

Create `spec/people.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type People = typeof import("../src/people.ts");
type Houses = typeof import("../src/houses.ts");

let dbPath: string;

async function boot(): Promise<{ people: People; houses: Houses }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return {
    people: (await import("../src/people.ts")) as People,
    houses: (await import("../src/houses.ts")) as Houses,
  };
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("who is in the village", () => {
  it("lists the four houses with the meeting house last", async () => {
    const { houses } = await boot();
    expect(houses.listHouses().map((h) => h.slug)).toEqual([
      "cottage",
      "brothers",
      "cabin",
      "meeting",
    ]);
    expect(houses.houseBySlug("meeting")?.kind).toBe("meeting");
    expect(houses.houseBySlug("nowhere")).toBeUndefined();
  });

  it("records a person by the name they chose, not one it made up", async () => {
    const { people } = await boot();
    const person = people.ensurePerson("tok-1", "An", "cabin");
    expect(person).toEqual({ token: "tok-1", name: "An", homeSlug: "cabin" });
    expect(people.nameOf("tok-1")).toBe("An");
  });

  it("refuses a blank name and an unknown house, with a reason", async () => {
    const { people } = await boot();
    expect(people.ensurePerson("tok-2", "   ", "cabin")).toBe("blank-name");
    expect(people.ensurePerson("tok-2", "An", "treehouse")).toBe("unknown-house");
    expect(people.getPerson("tok-2")).toBeUndefined();
  });

  it("lets someone change their name and move house without becoming a new person", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-3", "An", "cabin");
    people.ensurePerson("tok-3", "An Pham", "meeting");
    expect(people.getPerson("tok-3")).toEqual({
      token: "tok-3",
      name: "An Pham",
      homeSlug: "meeting",
    });
  });

  it("calls an unknown token someone, rather than guessing", async () => {
    const { people } = await boot();
    expect(people.nameOf("never-seen")).toBe("someone");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run spec/people.test.ts`
Expected: FAIL — cannot find module `../src/houses.ts`

- [ ] **Step 3: Write `src/houses.ts`**

```ts
import { db } from "./db.ts";

export interface House {
  id: number;
  slug: string;
  name: string;
  kind: "home" | "meeting";
}

/** Houses are seeded furniture, not content: the app never adds a fifth. */
export function listHouses(): House[] {
  return db.prepare("SELECT id, slug, name, kind FROM houses ORDER BY id").all() as House[];
}

export function houseBySlug(slug: string): House | undefined {
  return db.prepare("SELECT id, slug, name, kind FROM houses WHERE slug = ?").get(slug) as
    | House
    | undefined;
}
```

- [ ] **Step 4: Write `src/people.ts`**

```ts
import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";

export interface Person {
  token: string;
  name: string;
  homeSlug: string;
}

/** Why a person could not be recorded, or the person. Corroborated's habit:
 *  a refusal the app won't explain is the failure the app exists to avoid. */
export type PersonRefusal = "unknown-house" | "blank-name";

export function ensurePerson(
  token: string,
  name: string,
  homeSlug: string,
): Person | PersonRefusal {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return "blank-name";
  if (!houseBySlug(homeSlug)) return "unknown-house";
  db.prepare(
    `INSERT INTO people (token, name, home_slug) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET name = excluded.name, home_slug = excluded.home_slug`,
  ).run(token, trimmed, homeSlug);
  return { token, name: trimmed, homeSlug };
}

export function getPerson(token: string): Person | undefined {
  const row = db
    .prepare("SELECT token, name, home_slug AS homeSlug FROM people WHERE token = ?")
    .get(token) as Person | undefined;
  return row;
}

/** An unnamed token is "someone". The app does not invent a name for a person
 *  who has not given one. */
export function nameOf(token: string): string {
  return getPerson(token)?.name ?? "someone";
}
```

- [ ] **Step 5: Re-comment `src/identity.ts`**

Leave `ADJECTIVES`, `NOUNS`, `Visitor` and `nameFor` in place — `src/claims.ts` still calls `nameFor`, and Task 7 deletes both together. Only replace the file's leading comment:

```ts
// Who counts as a person is this app's call. Here it is a token in a cookie
// plus a name the person chose, because the family are specific people and a
// generated pseudonym would undo the point. The cookie helpers are the only
// thing here; the record itself lives in src/people.ts.
```

Keep every export exactly as it is. Nothing in this task removes code.

- [ ] **Step 6: Run the test and confirm it passes**

Run: `pnpm vitest run spec/people.test.ts`
Expected: PASS (5 tests)

Also run `pnpm typecheck` and confirm it is clean. Every task in this plan leaves the repo typechecking; if it does not, something was deleted too early.

- [ ] **Step 7: Commit**

```bash
git add src/houses.ts src/people.ts src/identity.ts spec/people.test.ts
git commit -m "feat: houses and people — chosen names, not generated ones"
```

---

### Task 3: Presence

**Files:**
- Create: `src/presence.ts`
- Create: `spec/presence.test.ts`

**Interfaces:**
- Consumes: `db` from `src/db.ts`, `houseBySlug` from `src/houses.ts`
- Produces: `PRESENCE_TTL_SECONDS: number` (45), `enter(token: string, houseSlug: string, atEpochSeconds?: number): void`, `leave(token: string): void`, `whoIsIn(houseSlug: string, atEpochSeconds?: number): string[]`, `whereEveryoneIs(atEpochSeconds?: number): Record<string, string[]>`

- [ ] **Step 1: Write the failing test**

Create `spec/presence.test.ts`:

```ts
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
    expect(p.whoIsIn("cabin", 1000)).toEqual([]);
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
    p.enter("alice", "cabin", 1001);
    expect(p.whoIsIn("meeting", 1001)).toEqual([]);
    expect(p.whoIsIn("cabin", 1001)).toEqual(["alice"]);
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
    p.enter("cat", "cabin", 1000);
    const everywhere = p.whereEveryoneIs(1000);
    expect(everywhere.meeting.sort()).toEqual(["alice", "bob"]);
    expect(everywhere.cabin).toEqual(["cat"]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run spec/presence.test.ts`
Expected: FAIL — cannot find module `../src/presence.ts`

- [ ] **Step 3: Write `src/presence.ts`**

```ts
import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";

/** How long after a page load the app still believes someone is in a room.
 *  An open event stream refreshes this, so a reader with JavaScript on stays
 *  present; a reader with it off is present for this long and then is not.
 *  This is why the interface says "was here" and never "saw". */
export const PRESENCE_TTL_SECONDS = 45;

const now = (): number => Math.floor(Date.now() / 1000);

export function enter(token: string, houseSlug: string, atEpochSeconds: number = now()): void {
  const house = houseBySlug(houseSlug);
  if (!house) return;
  db.prepare(
    `INSERT INTO presence (person, house_id, last_seen) VALUES (?, ?, ?)
     ON CONFLICT(person) DO UPDATE SET house_id = excluded.house_id, last_seen = excluded.last_seen`,
  ).run(token, house.id, atEpochSeconds);
}

export function leave(token: string): void {
  db.prepare("DELETE FROM presence WHERE person = ?").run(token);
}

export function whoIsIn(houseSlug: string, atEpochSeconds: number = now()): string[] {
  const house = houseBySlug(houseSlug);
  if (!house) return [];
  return db
    .prepare(
      `SELECT person FROM presence
        WHERE house_id = ? AND last_seen > ?
        ORDER BY person`,
    )
    .all(house.id, atEpochSeconds - PRESENCE_TTL_SECONDS)
    .map((r) => (r as { person: string }).person);
}

/** One query for the map, so drawing the village is not four round trips. */
export function whereEveryoneIs(atEpochSeconds: number = now()): Record<string, string[]> {
  const rows = db
    .prepare(
      `SELECT h.slug AS slug, p.person AS person
         FROM presence p JOIN houses h ON h.id = p.house_id
        WHERE p.last_seen > ?
        ORDER BY p.person`,
    )
    .all(atEpochSeconds - PRESENCE_TTL_SECONDS) as Array<{ slug: string; person: string }>;
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.slug] ??= []).push(r.person);
  return out;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run spec/presence.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Prove the TTL test can fail**

Temporarily flip the threshold arithmetic — `atEpochSeconds - PRESENCE_TTL_SECONDS` to
`atEpochSeconds + PRESENCE_TTL_SECONDS`, in both `whoIsIn` and `whereEveryoneIs` — re-run, confirm
**only** the TTL case goes red on an assertion mismatch, restore, confirm green.

Do not break it by editing the SQL text to `last_seen > 0`: that removes a placeholder the call site
still binds, so every test dies on `RangeError: Too many parameter values` and the TTL arithmetic is
never exercised. Nor by editing `PRESENCE_TTL_SECONDS` — the test derives its own expected thresholds
from that same constant, so changing it moves both sides and the test stays green. A break that takes
down tests it has nothing to do with is a broken break.

- [ ] **Step 6: Commit**

```bash
git add src/presence.ts spec/presence.test.ts
git commit -m "feat: presence with a 45s TTL — the app forgets rather than guessing"
```

---

### Task 4: Things and the witness rule

This is the core of the app. Every other task is scaffolding around it.

**Files:**
- Create: `src/things.ts`
- Create: `spec/village.test.ts`

**Interfaces:**
- Consumes: `db`, `houseBySlug`, `nameOf`, `whoIsIn`
- Produces:
  - `interface ThingView { id: number; body: string; placedBy: string; placedByName: string; createdAt: string; keeperNames: string[]; onShelf: boolean; isOwn: boolean; viewerHasKept: boolean }`
  - `place(houseSlug: string, placedBy: string, body: string, atEpochSeconds?: number): number | "unknown-house" | "blank-body"`
  - `type KeepRefusal = "unknown-thing" | "own-thing" | "already" | null`
  - `takeIn(thingId: number, person: string): KeepRefusal`
  - `inRoom(houseSlug: string, viewer: string): ThingView[]`
  - `onShelf(houseSlug: string, viewer: string): ThingView[]`

- [ ] **Step 1: Write the failing test**

Create `spec/village.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run spec/village.test.ts`
Expected: FAIL — cannot find module `../src/things.ts`

- [ ] **Step 3: Write `src/things.ts`**

```ts
import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { nameOf } from "./people.ts";
import { whoIsIn } from "./presence.ts";

export interface ThingView {
  id: number;
  body: string;
  placedBy: string;
  placedByName: string;
  createdAt: string;
  /** Everyone other than the placer who was in the room, or came later and
   *  took it in. Never includes the placer: that is the whole product. */
  keeperNames: string[];
  onShelf: boolean;
  isOwn: boolean;
  viewerHasKept: boolean;
}

export type PlaceRefusal = "unknown-house" | "blank-body";
export type KeepRefusal = "unknown-thing" | "own-thing" | "already" | null;

/** Placing is not keeping. The thing goes in the room either way; whoever
 *  else was already in the room becomes a keeper, and only then is it a
 *  memory. Nothing is withheld — an unkept thing stays visible forever. */
export function place(
  houseSlug: string,
  placedBy: string,
  body: string,
  atEpochSeconds?: number,
): number | PlaceRefusal {
  const trimmed = body.trim().slice(0, 280);
  if (!trimmed) return "blank-body";
  const house = houseBySlug(houseSlug);
  if (!house) return "unknown-house";

  const info = db
    .prepare("INSERT INTO things (house_id, placed_by, body) VALUES (?, ?, ?)")
    .run(house.id, placedBy, trimmed);
  const id = Number(info.lastInsertRowid);

  const witnesses = whoIsIn(houseSlug, atEpochSeconds).filter((p) => p !== placedBy);
  const keep = db.prepare("INSERT OR IGNORE INTO keepings (thing_id, person) VALUES (?, ?)");
  for (const person of witnesses) keep.run(id, person);
  return id;
}

export function takeIn(thingId: number, person: string): KeepRefusal {
  const thing = db.prepare("SELECT placed_by FROM things WHERE id = ?").get(thingId) as
    | { placed_by: string }
    | undefined;
  if (!thing) return "unknown-thing";
  // Enforced here AND by the keepings_not_own trigger, because a rule that
  // only one of them knows is a rule that can be forgotten.
  if (thing.placed_by === person) return "own-thing";
  const existing = db
    .prepare("SELECT 1 FROM keepings WHERE thing_id = ? AND person = ?")
    .get(thingId, person);
  if (existing) return "already";
  db.prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)").run(thingId, person);
  return null;
}

function viewsFor(houseSlug: string, viewer: string, shelfOnly: boolean): ThingView[] {
  const house = houseBySlug(houseSlug);
  if (!house) return [];
  const rows = db
    .prepare(
      `SELECT t.id, t.body, t.placed_by AS placedBy, t.created_at AS createdAt
         FROM things t
        WHERE t.house_id = ?
        ORDER BY t.id DESC
        LIMIT 200`,
    )
    .all(house.id) as Array<{ id: number; body: string; placedBy: string; createdAt: string }>;

  const keepers = db.prepare("SELECT person FROM keepings WHERE thing_id = ? ORDER BY id");

  const views = rows.map((r) => {
    const people = keepers.all(r.id).map((k) => (k as { person: string }).person);
    return {
      id: r.id,
      body: r.body,
      placedBy: r.placedBy,
      placedByName: nameOf(r.placedBy),
      createdAt: r.createdAt,
      keeperNames: people.map(nameOf),
      // Derived, never stored: a thing is kept iff somebody else's name is
      // on it, so the label cannot drift from the fact underneath it.
      onShelf: people.length > 0,
      isOwn: r.placedBy === viewer,
      viewerHasKept: people.includes(viewer),
    };
  });
  return shelfOnly ? views.filter((v) => v.onShelf) : views;
}

export function inRoom(houseSlug: string, viewer: string): ThingView[] {
  return viewsFor(houseSlug, viewer, false);
}

export function onShelf(houseSlug: string, viewer: string): ThingView[] {
  return viewsFor(houseSlug, viewer, true);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run spec/village.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Prove the two load-bearing tests can fail**

One at a time, confirm red, then restore:
1. In `place`, drop the `.filter((p) => p !== placedBy)`. The "never counts the placer as a keeper" case must go red (the trigger will throw).
2. In `viewsFor`, change `onShelf: people.length > 0` to `onShelf: true`. The "leaves a thing placed alone in the room" case must go red.

- [ ] **Step 6: Commit**

```bash
git add src/things.ts spec/village.test.ts
git commit -m "feat: the witness rule — a memory is something two of you were there for"
```

---

### Task 5: The event hub

**Files:**
- Create: `src/events.ts`
- Create: `spec/events.test.ts`

**Interfaces:**
- Consumes: nothing (deliberately has no `node:http` import, so it is testable without a server)
- Produces: `type Listener = (payload: string) => void`, `subscribe(houseSlug: string, listener: Listener): () => void`, `publish(houseSlug: string, payload: string): void`, `listenerCount(houseSlug: string): number`

- [ ] **Step 1: Write the failing test**

Create `spec/events.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run spec/events.test.ts`
Expected: FAIL — cannot find module `../src/events.ts`

- [ ] **Step 3: Write `src/events.ts`**

```ts
// Server-sent events, not WebSockets: the traffic is one-directional (the
// server says what changed; every action is an ordinary form POST), SSE
// survives proxies, and when it fails it degrades to a page that simply
// doesn't update rather than to a broken one. PROCESS.md records the choice.
//
// This module knows nothing about HTTP so it can be tested without a server.

export type Listener = (payload: string) => void;

const rooms = new Map<string, Set<Listener>>();

export function subscribe(houseSlug: string, listener: Listener): () => void {
  const set = rooms.get(houseSlug) ?? new Set<Listener>();
  set.add(listener);
  rooms.set(houseSlug, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) rooms.delete(houseSlug);
  };
}

/** One dead socket must not stop the rest of the room being told. */
export function publish(houseSlug: string, payload: string): void {
  for (const listener of rooms.get(houseSlug) ?? []) {
    try {
      listener(payload);
    } catch (err: unknown) {
      console.error(
        JSON.stringify({ at: new Date().toISOString(), level: "warn", msg: "listener failed", err: String(err) }),
      );
    }
  }
}

export function listenerCount(houseSlug: string): number {
  return rooms.get(houseSlug)?.size ?? 0;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run spec/events.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/events.ts spec/events.test.ts
git commit -m "feat: an event hub that knows nothing about HTTP"
```

---

### Task 6: The pages

**Files:**
- Modify: `src/render.ts` (add the village pages alongside the existing `claimsPage`, which Task 7 deletes with its last caller; keep `esc`, `page` and `markdown`)

**Interfaces:**
- Consumes: `House` from `src/houses.ts`, `ThingView` from `src/things.ts`
- Produces: `esc`, `page(title: string, inner: string): string`, `markdown(src: string): string` (all unchanged), plus `mapPage(houses: Array<House & { hereNames: string[] }>, me: Person | undefined, message: string | null): string`, `housePage(house: House, me: Person, hereNames: string[], things: ThingView[], message: string | null): string`, `roomFragment(things: ThingView[]): string`, `joinPage(houses: House[], message: string | null): string`

- [ ] **Step 1: Replace the stylesheet tokens**

In `src/render.ts`, replace the `:root` and `@media (prefers-color-scheme: dark)` blocks and the status rules with these. Keep every other rule.

```css
:root {
  --ink: oklch(0.24 0.02 60);
  --paper: oklch(0.98 0.012 85);
  --rule: oklch(0.86 0.02 70);
  --quiet: oklch(0.52 0.02 70);
  --room: oklch(0.58 0.10 55);
  --shelf: oklch(0.50 0.09 150);
  --here: oklch(0.55 0.13 250);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: oklch(0.93 0.01 80); --paper: oklch(0.19 0.02 60); --rule: oklch(0.36 0.02 70);
    --quiet: oklch(0.72 0.02 70); --room: oklch(0.80 0.10 55);
    --shelf: oklch(0.78 0.09 150); --here: oklch(0.80 0.11 250);
  }
}
.state { font-weight: 600; font-size: 0.85rem; letter-spacing: 0.02em; }
.state[data-state="in-the-room"] { color: var(--room); }
.state[data-state="on-the-shelf"] { color: var(--shelf); }
.here { color: var(--here); font-size: 0.9rem; }
ul.village { list-style: none; padding: 0; display: grid; gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
li.house { border: 1px solid var(--rule); border-radius: 10px; padding: 1rem; }
li.house a { font-weight: 600; font-size: 1.05rem; display: inline-block; min-height: 44px; }
li.thing { border-top: 1px solid var(--rule); padding: 1rem 0; }
```

Also change the `nav` in `page()` to:

```ts
<nav aria-label="site"><a href="/">The village</a><a href="/readme/">About</a></nav>
```

- [ ] **Step 2: Write the village pages**

Leave `statusLine`, `claimItem` and `claimsPage` where they are — Task 7 deletes them with `src/claims.ts`. Add these three type imports to the **top of the file**, beside the existing `import type { ClaimView }` line (TypeScript import declarations must be at the top; adding them mid-file is a syntax error):

```ts
import type { House } from "./houses.ts";
import type { Person } from "./people.ts";
import type { ThingView } from "./things.ts";
```

Then add the rest after `page()`:

```ts
const names = (list: string[]): string =>
  list.length === 1 ? esc(list[0]) : list.slice(0, -1).map(esc).join(", ") + " and " + esc(list[list.length - 1]);

/** Two states, and the app says which one it is in. "In the room" is one
 *  person's record of something. "On the shelf" is a thing more than one
 *  person was there for. The app never collapses them. */
function stateLine(t: ThingView): string {
  if (!t.onShelf) {
    return `<span class="state" data-state="in-the-room">In the room</span>
      <span class="note">— nobody else was here when this was put down</span>`;
  }
  const n = t.keeperNames.length;
  return `<span class="state" data-state="on-the-shelf">On the shelf</span>
    <span class="note">— ${names(t.keeperNames)} ${n === 1 ? "was" : "were"} here too</span>`;
}

function thingItem(t: ThingView): string {
  let action: string;
  if (t.isOwn) {
    action = `<p class="note">You put this down, so you can't be the one who was here for it.</p>`;
  } else if (t.viewerHasKept) {
    action = `<p class="note">You were here for this.</p>`;
  } else {
    action = `<form method="post" action="/take">
      <input type="hidden" name="thing" value="${t.id}">
      <button>I was here for this</button></form>`;
  }
  return `<li class="thing">
    <p class="body">${esc(t.body)}</p>
    <p class="meta">${esc(t.placedByName)} · ${esc(t.createdAt)} UTC</p>
    <p>${stateLine(t)}</p>
    ${action}
  </li>`;
}

/** The room list on its own, so the event stream can swap it in without
 *  reloading the page. Rendered by the same function either way. */
export function roomFragment(things: ThingView[]): string {
  if (!things.length) {
    return `<p class="empty">Nothing in this room yet. Put something down — it stays
      here either way, and goes on the shelf when somebody else is here for it.</p>`;
  }
  return `<ol>${things.map(thingItem).join("")}</ol>`;
}

export function joinPage(houses: House[], message: string | null): string {
  const options = houses
    .map((h) => `<option value="${esc(h.slug)}">${esc(h.name)}</option>`)
    .join("");
  return page(
    "The village",
    `<main>
      <h1>The village</h1>
      <p class="lede">Four places and the people in them. Before you go in,
        say who you are — the app keeps a name and nothing else.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/join">
        <label for="name">What should everyone call you?</label>
        <input id="name" name="name" required maxlength="40" placeholder="An">
        <label for="home">Which house is yours?</label>
        <select id="home" name="home" required>${options}</select>
        <button>Go in</button>
      </form>
    </main>`,
  );
}

export function mapPage(
  houses: Array<House & { hereNames: string[] }>,
  me: Person,
  message: string | null,
): string {
  const cards = houses
    .map(
      (h) => `<li class="house">
        <a href="/house/${esc(h.slug)}">${esc(h.name)}</a>
        <p class="here">${h.hereNames.length ? names(h.hereNames) + (h.hereNames.length === 1 ? " is here" : " are here") : "Nobody is here"}</p>
      </li>`,
    )
    .join("");
  return page(
    "The village",
    `<main>
      <h1>The village</h1>
      <p class="lede">A thing you put down stays in the room you put it in.
        It goes on that house's shelf when somebody else was there for it —
        a memory is something two of you were there for.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <h2>Houses</h2>
      <ul class="village">${cards}</ul>
      <p class="note">You're here as <strong>${esc(me.name)}</strong>.
        <a href="/leave">Leave the village</a></p>
    </main>`,
  );
}

export function housePage(
  house: House,
  me: Person,
  hereNames: string[],
  things: ThingView[],
  message: string | null,
): string {
  const others = hereNames.filter((n) => n !== me.name);
  return page(
    house.name,
    `<main>
      <h1>${esc(house.name)}</h1>
      <p class="lede" id="who">${others.length ? names(others) + (others.length === 1 ? " was here in the last minute." : " were here in the last minute.") : "Nobody else has been here in the last minute."}</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/place">
        <input type="hidden" name="house" value="${esc(house.slug)}">
        <label for="body">What do you want to put down here?</label>
        <input id="body" name="body" required maxlength="280" placeholder="He stood up on his own today">
        <button>Put it down</button>
      </form>
      <h2>In this house</h2>
      <div id="room">${roomFragment(things)}</div>
      <p class="note"><a href="/">Back to the village</a></p>
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        const stream = new EventSource("/stream?house=${esc(house.slug)}");
        stream.onmessage = async () => {
          const res = await fetch("/house/${esc(house.slug)}/room", { headers: { accept: "text/html" } });
          if (res.ok) room.innerHTML = await res.text();
        };
      </script>
    </main>`,
  );
}
```

- [ ] **Step 3: Confirm the repo still typechecks**

Run: `pnpm typecheck`
Expected: clean. The new page functions are unused so far — Task 7 wires them up — but nothing is broken by adding them.

- [ ] **Step 4: Commit**

```bash
git add src/render.ts
git commit -m "feat: the map, the house page, and the room fragment the stream swaps in"
```

---

### Task 7: Routes — switch the server to the village

**Files:**
- Modify: `src/server.ts` (replace the claim routes)
- Delete: `src/claims.ts`, `spec/claims.test.ts`
- Modify: `src/render.ts` (now delete `statusLine`, `claimItem`, `claimsPage` and the `import type { ClaimView }` line)
- Modify: `src/identity.ts` (now delete `ADJECTIVES`, `NOUNS`, the `Visitor` interface and `nameFor`; keep `newToken` and `readCookie`)
- Modify: `src/db.ts` (delete the `claims` and `corroborations` `CREATE TABLE` block — the tables stay in any existing database file, harmlessly, and no code reads them)

**Interfaces:**
- Consumes: everything produced by Tasks 2–6
- Produces: routes `GET /`, `GET /house/:slug`, `GET /house/:slug/room`, `GET /stream?house=:slug`, `GET /leave`, `GET /readme/`, `POST /join`, `POST /place`, `POST /take`

- [ ] **Step 1: Write the failing test**

Create `spec/routes.test.ts`:

```ts
import { expect, inject, it, describe } from "vitest";

// Against the RUNNING app, because these are about what a browser gets.
const baseUrl = inject("baseUrl");

/** A session is a cookie jar. Two of these is two people. */
function session(): { get: (p: string) => Promise<Response>; post: (p: string, body: Record<string, string>) => Promise<Response> } {
  let cookie = "";
  const remember = (res: Response): Response => {
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
  const get = async (p: string): Promise<Response> =>
    remember(await fetch(new URL(p, baseUrl), { headers: cookie ? { cookie } : {}, redirect: "manual" }));
  const post = async (p: string, body: Record<string, string>): Promise<Response> =>
    remember(
      await fetch(new URL(p, baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          ...(cookie ? { cookie } : {}),
        },
        body: new URLSearchParams(body).toString(),
        redirect: "manual",
      }),
    );
  return { get, post };
}

describe("what a browser gets", () => {
  it("asks a new arrival for a name before letting them into the village", async () => {
    const s = session();
    const res = await s.get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("What should everyone call you?");
  });

  it("lets someone join and then shows them the four houses", async () => {
    const s = session();
    await s.get("/");
    const joined = await s.post("/join", { name: "Alice", home: "cabin" });
    expect(joined.status).toBe(303);
    const map = await s.get("/");
    const html = await map.text();
    expect(html).toContain("The meeting house");
    expect(html).toContain("Alice");
  });

  it("places a thing with a plain form POST, no JavaScript involved", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    await s.get("/house/meeting");
    const placed = await s.post("/place", { house: "meeting", body: "a form post works" });
    expect(placed.status).toBe(303);
    const room = await (await s.get("/house/meeting/room")).text();
    expect(room).toContain("a form post works");
    expect(room).toContain("In the room");
  });

  it("explains a refusal in words rather than dropping it", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    await s.get("/house/meeting");
    const placed = await s.post("/place", { house: "meeting", body: "mine alone" });
    expect(placed.status).toBe(303);
    const id = /value="(\d+)"/.exec(await (await s.get("/house/meeting/room")).text());
    // The placer's own thing offers no button, so take it in by hand to prove
    // the server refuses the request even when the button is absent.
    const refused = await s.post("/take", { thing: id ? id[1] : "1" });
    expect(refused.status).toBe(303);
    const after = await (await s.get("/house/meeting")).text();
    expect(after).toMatch(/can't be the one who was here|put this down/);
  });

  it("answers 404 for a house that does not exist", async () => {
    const s = session();
    await s.get("/");
    await s.post("/join", { name: "Alice", home: "cabin" });
    expect((await s.get("/house/treehouse")).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

With `pnpm dev` running:

Run: `pnpm vitest run spec/routes.test.ts`
Expected: FAIL — the old app answers with "Corroborated", not a join form.

- [ ] **Step 3: Rewrite `src/server.ts`**

Replace the whole file:

```ts
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { publish, subscribe } from "./events.ts";
import { houseBySlug, listHouses } from "./houses.ts";
import { newToken, readCookie } from "./identity.ts";
import { ensurePerson, getPerson, nameOf, type Person } from "./people.ts";
import { enter, leave, whereEveryoneIs, whoIsIn } from "./presence.ts";
import { housePage, joinPage, mapPage, markdown, page, roomFragment } from "./render.ts";
import { inRoom, place, takeIn } from "./things.ts";

const PORT = Number(process.env.PORT ?? 8080);
const COOKIE = "who";
const PING_MS = 15_000;

async function formData(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

const html = (res: ServerResponse, status: number, body: string, cookie?: string): void => {
  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(status, headers);
  res.end(body);
};

const seeOther = (res: ServerResponse, to: string, cookie?: string): void => {
  const headers: Record<string, string> = { location: to };
  if (cookie) headers["set-cookie"] = cookie;
  res.writeHead(303, headers);
  res.end();
};

const said = (to: string, message: string): string => `${to}?said=${encodeURIComponent(message)}`;

/** Every refusal gets words. A button that appears to do nothing teaches the
 *  user the system is broken; being told the rule teaches them the rule. */
const REFUSALS: Record<string, string> = {
  "unknown-house": "There's no such house in this village.",
  "blank-name": "The app needs something to call you.",
  "blank-body": "There's nothing there to put down.",
  "unknown-thing": "That isn't here any more, so nothing was recorded.",
  "own-thing": "You put this down, so you can't be the one who was here for it. A memory is something two of you were there for.",
  already: "You'd already said you were here for this. One person is one keeper, however many times they click.",
};

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const message = url.searchParams.get("said");

    let token = readCookie(req.headers.cookie, COOKIE);
    let setCookie: string | undefined;
    if (!token) {
      token = newToken();
      setCookie = `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
    }
    const me: Person | undefined = getPerson(token);

    // The README is published whether or not you've said who you are.
    if (req.method === "GET" && path === "/readme") {
      const src = readFileSync(new URL("../README.md", import.meta.url), "utf8");
      html(res, 200, page("About — the village", `<main>${markdown(src)}</main>`), setCookie);
      return;
    }

    if (req.method === "POST" && path === "/join") {
      const form = await formData(req);
      const result = ensurePerson(token, form.get("name") ?? "", form.get("home") ?? "");
      if (typeof result === "string") {
        seeOther(res, said("/", REFUSALS[result]), setCookie);
        return;
      }
      seeOther(res, "/", setCookie);
      return;
    }

    if (!me) {
      // No door and no password — the brief leaves who counts as a person
      // open — but the app does need something to call you.
      html(res, 200, joinPage(listHouses(), message), setCookie);
      return;
    }

    if (req.method === "GET" && path === "/") {
      const everywhere = whereEveryoneIs();
      const houses = listHouses().map((h) => ({
        ...h,
        hereNames: (everywhere[h.slug] ?? []).map(nameOf),
      }));
      html(res, 200, mapPage(houses, me, message), setCookie);
      return;
    }

    if (req.method === "GET" && path === "/leave") {
      leave(token);
      seeOther(res, said("/", "You've left the village. Everything you put down is still where you put it."), setCookie);
      return;
    }

    const room = /^\/house\/([a-z-]+)\/room$/.exec(path);
    if (req.method === "GET" && room) {
      const house = houseBySlug(room[1]);
      if (!house) { html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such house.</p></main>")); return; }
      enter(token, house.slug);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(roomFragment(inRoom(house.slug, token)));
      return;
    }

    const stream = req.method === "GET" && path === "/stream" ? url.searchParams.get("house") : null;
    if (stream) {
      const house = houseBySlug(stream);
      if (!house) { res.writeHead(404).end(); return; }
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(": open\n\n");
      const unsubscribe = subscribe(house.slug, (payload) => res.write(`data: ${payload}\n\n`));
      // An open stream is what keeps someone present: the heartbeat refreshes
      // their 45 seconds and keeps intermediaries from closing the socket.
      const ping = setInterval(() => {
        enter(token, house.slug);
        res.write(": ping\n\n");
      }, PING_MS);
      req.on("close", () => {
        clearInterval(ping);
        unsubscribe();
      });
      return;
    }

    const visit = /^\/house\/([a-z-]+)$/.exec(path);
    if (req.method === "GET" && visit) {
      const house = houseBySlug(visit[1]);
      if (!house) { html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such house.</p></main>"), setCookie); return; }
      // Arriving is what makes you present, so a reader with JavaScript off
      // still counts for the 45 seconds the app will admit to.
      enter(token, house.slug);
      const here = whoIsIn(house.slug).map(nameOf);
      html(res, 200, housePage(house, me, here, inRoom(house.slug, token), message), setCookie);
      publish(house.slug, "arrived");
      return;
    }

    if (req.method === "POST" && path === "/place") {
      const form = await formData(req);
      const slug = (form.get("house") ?? "").trim();
      const result = place(slug, token, form.get("body") ?? "");
      if (typeof result === "string") {
        seeOther(res, said(`/house/${slug}`, REFUSALS[result]), setCookie);
        return;
      }
      publish(slug, "placed");
      seeOther(res, `/house/${slug}`, setCookie);
      return;
    }

    if (req.method === "POST" && path === "/take") {
      const form = await formData(req);
      const thingId = Number(form.get("thing"));
      const back = form.get("house") ?? "";
      if (!Number.isInteger(thingId)) {
        seeOther(res, said(`/house/${back}`, REFUSALS["unknown-thing"]), setCookie);
        return;
      }
      const refusal = takeIn(thingId, token);
      const slug = back || "meeting";
      if (refusal) { seeOther(res, said(`/house/${slug}`, REFUSALS[refusal]), setCookie); return; }
      publish(slug, "kept");
      seeOther(res, `/house/${slug}`, setCookie);
      return;
    }

    html(res, 404, page("Not found", "<main><h1>Not found</h1><p>No such page.</p></main>"), setCookie);
  })().catch((err: unknown) => {
    console.error(JSON.stringify({ at: new Date().toISOString(), level: "error", err: String(err) }));
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Something went wrong.");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({ at: new Date().toISOString(), level: "info", msg: "listening", port: PORT }));
});
```

- [ ] **Step 4: Carry the house through the take form**

`/take` needs to know which house to return to. In `src/render.ts`, `thingItem` must include it. Change `thingItem` to take the slug:

```ts
function thingItem(t: ThingView, houseSlug: string): string {
```

and inside the final `else` branch:

```ts
    action = `<form method="post" action="/take">
      <input type="hidden" name="thing" value="${t.id}">
      <input type="hidden" name="house" value="${esc(houseSlug)}">
      <button>I was here for this</button></form>`;
```

Then thread the slug through `roomFragment`:

```ts
export function roomFragment(things: ThingView[], houseSlug: string): string {
```

with the list line becoming `things.map((t) => thingItem(t, houseSlug)).join("")`, and update both call sites (`housePage` passes `house.slug`; `src/server.ts`'s `/house/:slug/room` passes `house.slug`).

- [ ] **Step 5: Delete the old app**

```bash
git rm src/claims.ts spec/claims.test.ts
```

In `src/db.ts`, delete the `db.exec(...)` block that creates `claims` and `corroborations`, and the comment above it.

In `src/render.ts`, delete `statusLine`, `claimItem`, `claimsPage` and the now-unused `import type { ClaimView } from "./claims.ts";` line.

In `src/identity.ts`, delete `ADJECTIVES`, `NOUNS`, the `Visitor` interface and `nameFor`. Keep `newToken` and `readCookie`.

- [ ] **Step 6: Run the whole suite and confirm it passes**

Restart `pnpm dev`, then:

Run: `pnpm check`
Expected: typecheck clean, all of `spec/schema`, `spec/people`, `spec/presence`, `spec/village`, `spec/events`, `spec/routes`, `spec/invariants` PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src spec
git commit -m "feat: the village replaces Corroborated — routes, join, rooms and refusals"
```

---

### Task 8: Prove it is real-time

The brief's definition: *a change one person makes appears in every other open session showing it within about a second, with no reload or other action by the viewer.* This task tests exactly that sentence.

**Files:**
- Create: `spec/realtime.test.ts`

**Interfaces:**
- Consumes: the running app
- Produces: nothing

- [ ] **Step 1: Write the failing test**

Create `spec/realtime.test.ts`:

```ts
import { expect, inject, it, describe } from "vitest";

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

describe("real-time, by the brief's definition", () => {
  it("shows one person's change in another open session in under a second", async () => {
    const alice = await join("Alice", "cabin");
    const bob = await join("Bob", "cottage");

    // Bob is in the meeting house with a stream open.
    await fetch(new URL("/house/meeting", baseUrl), { headers: { cookie: bob } });
    const waiting = firstEvent(bob, "meeting", 1000);
    // Give the subscription a moment to register before Alice acts.
    await new Promise((r) => setTimeout(r, 100));

    const started = Date.now();
    await fetch(new URL("/place", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
      body: new URLSearchParams({ house: "meeting", body: "within a second" }).toString(),
      redirect: "manual",
    });

    await expect(waiting).resolves.toBe("placed");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("puts the thing on the shelf because the other person was in the room", async () => {
    const alice = await join("Alice", "cabin");
    const bob = await join("Bob", "cottage");

    await fetch(new URL("/house/cabin", baseUrl), { headers: { cookie: bob } });
    await fetch(new URL("/place", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: alice },
      body: new URLSearchParams({ house: "cabin", body: "bob was here for this" }).toString(),
      redirect: "manual",
    });

    const room = await (await fetch(new URL("/house/cabin/room", baseUrl), { headers: { cookie: alice } })).text();
    expect(room).toContain("bob was here for this");
    expect(room).toContain("On the shelf");
    expect(room).toContain("Bob");
  });
});
```

- [ ] **Step 2: Run the test and confirm it passes**

With `pnpm dev` running:

Run: `pnpm vitest run spec/realtime.test.ts`
Expected: PASS (2 tests)

If the first test times out, the cause is almost always that `publish` runs before `subscribe` registered — increase the 100ms settle, not the 1000ms deadline. The deadline is the requirement.

- [ ] **Step 3: Prove the real-time test can fail**

Comment out `publish(slug, "placed")` in the `/place` route, re-run, confirm the first test goes red with "stream closed" or an abort. Restore, confirm green.

- [ ] **Step 4: Check it by hand, in two browsers**

Open two browser windows side by side, join as two different people, both go to the meeting house, and place something in one. The other must update without being touched. Then repeat with JavaScript disabled in one window and confirm the page still renders, the form still posts, and the thing still appears on reload.

- [ ] **Step 5: Commit**

```bash
git add spec/realtime.test.ts
git commit -m "test: real-time by the brief's definition — one second, two sessions, no reload"
```

---

### Task 9: README and CLAUDE.md

The marker starts at `/readme/`, then reads `CLAUDE.md`, then `spec/`, looking for the same idea in each.

**Files:**
- Modify: `README.md` (full rewrite, 400–600 words)
- Modify: `CLAUDE.md` (full rewrite)

**Interfaces:**
- Consumes: the argument in `docs/superpowers/specs/2026-10-08-family-village-design.md`
- Produces: nothing in code. `spec/invariants.test.ts` checks every README heading appears at `/readme/`, in order.

- [ ] **Step 1: Rewrite `README.md`**

Draft it yourself — the brief warns that a README reading like agent output marks down, and this one is about your family, which no agent can write. Keep it to 400–600 words with these headings, and say explicitly which claims are enforced and which are judged:

- `# The village` (or the family's own word for home)
- `## What good means here` — sharing is easy, keeping is hard; a memory is something two of you were there for; the two states and why the app never collapses them.
- `## What I read` — at least three sources, cited with links. Robin Sloan's *An app can be a home-cooked meal* carries over and fits better here than it did in Corroborated. Add something on the method of loci (Frances Yates, *The Art of Memory*) for why rooms rather than a feed, and one practitioner piece on the small web or software for a handful of people.
- `## What the checks enforce, and what they don't` — enforced: nothing reaches the shelf with one name on it; the placer can never be a keeper, by any path; one person counts once; things and shelves survive a restart; a thing can be placed with JavaScript off; a change reaches a second session in under a second. Judged: whether the village reads as a place, whether the shelf is worth coming back to, whether the two states are legible to someone who hasn't read the rules.
- `## What I chose not to build` — accounts, notifications, direct messages, games, photo storage (crit 10), deletion. And: the app has no door, so say plainly that the deployment is a public URL and the village is not private.

- [ ] **Step 2: Rewrite `CLAUDE.md`**

Keep the structure of the existing file — it works. Replace the Corroborated rules with the village's, under the same headings:

- *What the app must never do*: never show a thing on the shelf with only one name on it; never delete or expire anything anyone placed; never use the word "saw" (the app knows who was *here*); never let someone keep their own thing; never drop an action without words; collect nothing beyond a chosen name in a cookie; never claim privacy the app does not have.
- *Rules that live in the schema, not just in code*: `UNIQUE (thing_id, person)` and the `keepings_not_own` trigger. A migration that drops either is wrong.
- *Checks*: a test that has never been seen to fail is not evidence; the harness needs the app running; keep the shipped invariants as shipped.
- *This repo is public*: unchanged.
- *Stack facts*: unchanged, plus — presence has a 45-second TTL named once in `src/presence.ts`; the event hub has no `node:http` import so it stays testable.
- *The page*: unchanged (custom properties only, 44×44, status in text, one `h1`, works with JavaScript off).

- [ ] **Step 3: Confirm `/readme/` still passes**

Restart `pnpm dev`, then:

Run: `pnpm check`
Expected: PASS, including "publishes README.md at /readme/" with the new headings.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: the argument and the rules for the village"
```

---

### Task 10: Process evidence, deploy, verify

**Files:**
- Modify: `PROCESS.md` (rewrite, 900–1100 words — the brief says rewrite at each crit, not append)
- Create: `reflections/crit-9.md`

**Interfaces:**
- Consumes: the commit history from Tasks 1–9 and the `crit-8` tag
- Produces: the crit-9 submission

- [ ] **Step 1: Rewrite `PROCESS.md`**

It must describe the project as it stands now, not its history of edits. Cover, citing commits by hash:

- **The pivot.** Corroborated shipped at crit 8 and was abandoned on 8 October: one verb, no second act. What was kept was the idea — a thing needs a second person — and `crit-8` is tagged so the discarded app is readable. This is the strongest process evidence in the repo; the HD band asks for judgement visible in what was thrown away, so say what was thrown away and why.
- **The stack case.** Node running TypeScript directly, no build step; `better-sqlite3` on the one `/data` volume; SSE over WebSockets because traffic is one-directional, actions are form POSTs, and SSE degrades to a page that doesn't update rather than one that breaks. Name what each cost.
- **The multi-person decision** the crit asks for, written down: the witness rule. Everyone present when something is placed becomes a keeper automatically; later arrivals take it in by hand; the placer never can, enforced twice (in `takeIn` and in the `keepings_not_own` trigger) because a rule only one layer knows is a rule that can be forgotten.
- **Corrections landing in the harness.** For each test you broke and confirmed red in Tasks 1, 3, 4 and 8, say what it caught. A retry that went green is not evidence; a guard proven to fire is.

- [ ] **Step 2: Write `reflections/crit-9.md`**

Follow the shape of `reflections/crit-8.md`. The honest material: deciding to throw away a shipped app six days before a crit, how the concept was chosen and the several that were rejected, and what the witness rule cost to enforce in two places.

- [ ] **Step 3: Run the full check against the built image**

```bash
pnpm check
```

Expected: typecheck clean, every spec file green.

- [ ] **Step 4: Commit and push**

```bash
git add PROCESS.md reflections/crit-9.md
git commit -m "docs: process and reflection for crit 9 — the pivot, the stack case, the witness rule"
git push
```

- [ ] **Step 5: Deploy and verify live**

The repo is already public, so CI deploys on push to `main`. Confirm the run is green, then check the deployed app by hand:

- `/readme/` serves the new README in full
- two browser windows, two people, a thing placed in one appears in the other in about a second
- the same thing lands on the shelf with the other person's name on it
- a keyboard-only pass: tab to the form, place something, tab to "I was here for this", activate it
- a resize mid-interaction, at both marking viewports
- reload after a redeploy and confirm the shelf is still there

- [ ] **Step 6: Tag the cutoff**

Before Wednesday 14 October, 13:30 Canberra:

```bash
/comp4020:ship
```

Then confirm the `crit-9` tag exists and the live URL serves.

---

## Self-review

**Spec coverage.** Every section of the design spec maps to a task: schema and the two schema-level invariants (T1), identity and chosen names (T2), presence and the TTL (T3), the witness rule and the room/shelf distinction (T4), SSE (T5, T8), the pages and the JavaScript-off path (T6, T7), enforced-versus-judged (T9), the crit-9 delivery slice and the written-down multi-person decision (T10). Photos, logging and the visual direction are explicitly out of this slice and belong to crit 10 and the final.

**Known gaps, deliberately left.** `/leave` clears presence but there is no test for it beyond the unit test in T3 — it is a one-line route. The `people.home_slug` column is recorded and displayed on joining but nothing in the crit-9 slice reads it further; it earns its place at crit 10 when a house shows who lives there, and is kept now so the join form asks the question once rather than twice.

**Type consistency.** `roomFragment(things, houseSlug)` takes two arguments from T7 Step 4 onward — T6 introduces it with one and T7 amends it; both call sites are named. `ThingView.keeperNames` is used under that name in T4, T6 and T9. `PRESENCE_TTL_SECONDS` is defined once in T3 and imported, never re-stated. `place()` returns `number | PlaceRefusal` and every caller narrows with `typeof result === "string"`.
