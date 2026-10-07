import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

// One SQLite file is the whole persistent state. fly.toml mounts the only
// durable storage at /data, so that's the default in production; locally it
// falls back to an untracked file beside the repo.
const path =
  process.env.DATABASE_PATH ?? (existsSync("/data") ? "/data/app.db" : "./.data/app.db");
mkdirSync(dirname(path), { recursive: true });

export const db = new Database(path);
db.pragma("journal_mode = WAL");
// SQLite defaults foreign_keys to OFF per connection, and better-sqlite3
// does not turn it on implicitly. Without this, every REFERENCES clause
// below is documentation, not a constraint.
db.pragma("foreign_keys = ON");

// The smallest schema that carries the core interaction: a claim someone
// made, and the separate, later act of someone else saying they saw it too.
// Those are different events and the app never merges them.
db.exec(`
  CREATE TABLE IF NOT EXISTS claims (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    body       TEXT    NOT NULL,
    place      TEXT    NOT NULL,
    author     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- UNIQUE(claim_id, author) is the honesty rule in the schema rather than in
  -- a code path that can be forgotten: one person corroborating twice is one
  -- witness, not two.
  CREATE TABLE IF NOT EXISTS corroborations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id   INTEGER NOT NULL REFERENCES claims(id),
    author     TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (claim_id, author)
  );
`);

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
