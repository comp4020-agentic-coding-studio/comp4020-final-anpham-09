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

  -- Append-only: one person's perspective on a thing never overwrites
  -- another's, and never overwrites the original body in "things" either.
  CREATE TABLE IF NOT EXISTS perspectives (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    thing_id   INTEGER NOT NULL REFERENCES things(id),
    author     TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Keeping is no longer a side effect of presence: it requires the keeper
  -- to have written a perspective first. Enforced here, not just in code, for
  -- the same reason keepings_not_own is a trigger and not just a check.
  -- The second WHEN clause only applies this check to an attempt that would
  -- otherwise succeed (a real thing, not the placer's own): SQLite does not
  -- guarantee which of several BEFORE triggers on one table fires first, so
  -- without this guard an own-thing or unknown-thing attempt could surface
  -- this trigger's message instead of the more fundamental one underneath it.
  CREATE TRIGGER IF NOT EXISTS keepings_require_perspective
  BEFORE INSERT ON keepings
  FOR EACH ROW
  WHEN NOT EXISTS (
    SELECT 1 FROM perspectives WHERE thing_id = NEW.thing_id AND author = NEW.person
  )
  AND EXISTS (
    SELECT 1 FROM things WHERE id = NEW.thing_id AND placed_by != NEW.person
  )
  BEGIN
    SELECT RAISE(ABORT, 'a keeper must have written a perspective on this thing first');
  END;

  -- The only mutable table in the app. Presence is live state, not something
  -- anyone put down, so it is overwritten rather than appended.
  CREATE TABLE IF NOT EXISTS presence (
    person    TEXT    PRIMARY KEY,
    house_id  INTEGER NOT NULL REFERENCES houses(id),
    last_seen INTEGER NOT NULL
  );

  -- A game of ô ăn quan at the meeting house. Seating lives here rather than
  -- in the presence table, deliberately: presence is keyed on the person alone and
  -- expires after 45 seconds, and a chair that empties because somebody went
  -- to make tea is the wrong model for a game. A seat is held until the
  -- player stands up.
  CREATE TABLE IF NOT EXISTS games (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    house_id    INTEGER NOT NULL REFERENCES houses(id),
    bottom      TEXT    NOT NULL,
    top         TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at    TEXT,
    -- 'finished' means both quan were captured and there is a real score.
    -- 'stopped' means somebody ended it early: no score, no winner, and
    -- nothing to put on a shelf. The two are different endings and the
    -- interface must not offer to keep the second one.
    ended       TEXT CHECK (ended IS NULL OR ended IN ('finished','stopped')),
    -- The game's own keepings_not_own: a game needs two of you. Both columns
    -- are on one row, so a CHECK says it without needing a trigger.
    CHECK (top IS NULL OR top != bottom)
  );

  -- One game at a time per house, enforced here rather than in a code path
  -- that can be forgotten. A partial index is the cheapest correct place for
  -- it: two live games would give the room two boards and no way to say
  -- which one "the table" means.
  CREATE UNIQUE INDEX IF NOT EXISTS one_live_game_per_house
    ON games(house_id) WHERE ended IS NULL;

  -- The moves are the game. The board_after column beside them is derived, and the
  -- exception is argued in CLAUDE.md rather than smuggled in: it has exactly
  -- one writer (the engine, in the same INSERT as the move that produced it)
  -- and no UPDATE path at all, so it cannot drift from the move list the way
  -- a cached on-the-shelf boolean could drift from a keepings row. A test
  -- replays the moves through the pure engine and checks it reproduces every
  -- stored board, which makes the claim checkable rather than a habit.
  CREATE TABLE IF NOT EXISTS moves (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id       INTEGER NOT NULL REFERENCES games(id),
    seq           INTEGER NOT NULL,
    side          TEXT    NOT NULL CHECK (side IN ('bottom','top')),
    kind          TEXT    NOT NULL CHECK (kind IN ('sow','refill')),
    pit           INTEGER,
    direction     TEXT CHECK (direction IS NULL OR direction IN ('left','right')),
    board_after   TEXT    NOT NULL,
    bottom_after  INTEGER NOT NULL,
    top_after     INTEGER NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (game_id, seq)
  );

  -- "Never delete or expire anything anyone placed", put where no code path
  -- can route around it. A played move is a thing that happened; rewriting
  -- one would silently falsify the record the board is built from.
  CREATE TRIGGER IF NOT EXISTS moves_never_change
  BEFORE UPDATE ON moves
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'a move that has been played cannot be changed');
  END;

  CREATE TRIGGER IF NOT EXISTS moves_never_vanish
  BEFORE DELETE ON moves
  FOR EACH ROW
  BEGIN
    SELECT RAISE(ABORT, 'a move that has been played cannot be taken back');
  END;
`);

// Additive migration, post-crit-9: two nullable/defaulted columns on an
// existing table. CREATE TABLE IF NOT EXISTS is naturally idempotent across
// restarts; ALTER TABLE is not, so each column is only added if missing —
// checked against a fresh read of the table's own columns every boot.
const thingsColumns = new Set(
  (db.prepare("PRAGMA table_info(things)").all() as Array<{ name: string }>).map((c) => c.name),
);
if (!thingsColumns.has("title")) {
  db.exec("ALTER TABLE things ADD COLUMN title TEXT NOT NULL DEFAULT ''");
}
if (!thingsColumns.has("event_date")) {
  db.exec("ALTER TABLE things ADD COLUMN event_date TEXT");
}
// A thing that is a finished game points back at it. Nullable because
// almost nothing is: this is the one kind of thing the app writes on
// somebody's behalf rather than taking from a form. It exists so that
// "has this game already been written down" is a question about the
// things table rather than a flag on the game that could drift from it.
if (!thingsColumns.has("game_id")) {
  db.exec("ALTER TABLE things ADD COLUMN game_id INTEGER REFERENCES games(id)");
}

// Houses are fixed furniture, not user-created content: the village is this
// family's three homes and the place they meet, and nothing in the app adds
// a fifth. Seeded once; renaming later is an UPDATE, not a new row.
const SEED: Array<[slug: string, name: string, kind: "home" | "meeting"]> = [
  ["nghe-an", "Nghe An", "home"],
  ["hanoi", "Hanoi", "home"],
  ["canberra", "Canberra", "home"],
  ["meeting", "The meeting house", "meeting"],
];
const seed = db.prepare("INSERT OR IGNORE INTO houses (slug, name, kind) VALUES (?, ?, ?)");
for (const [slug, name, kind] of SEED) seed.run(slug, name, kind);
