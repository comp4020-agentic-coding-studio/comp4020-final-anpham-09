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
