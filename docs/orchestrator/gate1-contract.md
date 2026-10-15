# GATE 1 — Frozen contract (A1-ARCH)

**Status:** approved by Orchestrator. One design, no competing rewrites. Implementers work from this document, not from re-reading `prompt.md` cover to cover.

**Locked decisions this contract implements** (all four confirmed by project owner):
1. Full rebuild per `prompt.md`'s P0 feature set (Memory Relay, Living Village Map, Memory Shelf).
2. Built on branch `prompt-rebuild`; `main` stays untouched as the crit-graded fallback.
3. Switch from presence-based auto-keep to `prompt.md` §3's explicit-action keep rule.
4. `PROCESS.md`'s existing crit-9 entry is NOT edited. A new, honestly dated section is added later (Gate 6) documenting the post-crit-9 pivot.

## 1. What is actually changing

The real diff here is smaller than the brief reads, because two things are already true:

- `src/events.ts` is a dumb payload-agnostic pub/sub, and the client's `stream.onmessage = resync` refetches the whole room fragment on *any* message. **No realtime/transport work is required.** Gate 3 is folded into Gate 2 — new write paths just call the existing `publish(slug, "...")` after commit, same as today.
- `"on the shelf" is derived, never stored` already holds exactly in the shape `prompt.md` wants: a `keepings` row is a keeper. The only thing moving is *what is allowed to produce a `keepings` row*.

So this is a **behavioural + additive-schema change to one file's core logic (`src/things.ts`)**, not a new domain.

## 2. Schema (additive only — no existing column or table is dropped or renamed)

```sql
ALTER TABLE things ADD COLUMN title      TEXT NOT NULL DEFAULT '';
ALTER TABLE things ADD COLUMN event_date TEXT;              -- nullable, user-supplied, free text/ISO date

CREATE TABLE IF NOT EXISTS perspectives (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thing_id   INTEGER NOT NULL REFERENCES things(id),
  author     TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Schema-enforced version of "a genuine written perspective" precondition.
-- Keeps the existing pattern (keepings_not_own) of putting the invariant
-- where no code path can forget it.
CREATE TRIGGER IF NOT EXISTS keepings_require_perspective
BEFORE INSERT ON keepings
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM perspectives WHERE thing_id = NEW.thing_id AND author = NEW.person
)
BEGIN
  SELECT RAISE(ABORT, 'a keeper must have written a perspective on this thing first');
END;
```

**Explicitly preserved, unchanged:** `keepings` table shape, `UNIQUE(thing_id, person)`, the `keepings_not_own` trigger, all of `houses`/`people`/`presence`. Existing `things`/`keepings` rows from the crit-9 deploy keep their meaning — legacy rows get `title = ''`, rendered as "(untitled)", never a fabricated title.

`event_date` vs `created_at` vs `kept_at`: `event_date` is the new nullable column (when the remembered thing happened); `created_at` is unchanged (when the memory was recorded); `kept_at` is **not a new column** — it is `keepings.created_at` for that person's row, read and labelled as "kept_at" at the view layer. No redundant timestamp is added.

## 3. Domain logic (`src/things.ts`) — the mechanic switch itself

**Removed:** the auto-keep block inside `place()` that reads `whoIsIn(houseSlug)` and inserts a `keepings` row per witness. Presence stops having any write-side effect. (Presence remains fully live/real for the map and room "who's here" display — §4 only.)

**`place()`** gains `title` and `eventDate` parameters; still a single `things` row insert; still returns `IN_ROOM` only after a successful persisted write; still the same `PlaceRefusal` shape (`"unknown-house" | "blank-body"`, plus a new `"blank-title"`).

**New: `addPerspective(thingId, author, body)`** — inserts an append-only `perspectives` row. No own-thing restriction (a creator may add more of their own words later; this does not make them a keeper of their own thing — the `keepings_not_own` trigger still blocks that regardless of perspective history). Refusal type: `"unknown-thing" | "blank-body"`.

**Renamed/repurposed: `takeIn` → `keepTogether(thingId, person)`** — this *is* "Keep this together". Preconditions, enforced redundantly exactly in the existing three-places style (CLAUDE.md: "enforced three times on purpose"):
1. Code check: thing exists → else `"unknown-thing"`.
2. Code check: person is not the placer → else `"own-thing"` (unchanged rule/wording).
3. Code check: person has at least one `perspectives` row for this thing → else new refusal `"no-perspective"`.
4. Insert into `keepings`; `UNIQUE` + both triggers are the schema-level backstop; the catch block maps `keepings_require_perspective`'s abort to the same `"no-perspective"` refusal and the existing own-thing abort to `"own-thing"`, same pattern as today.
5. Already-kept repeat call → `"already"` (unchanged).

Route path stays `POST /take` (no churn on an already-tested URL); the **button text and all user-facing language change to "Keep this together"**. `KeepRefusal` becomes `"unknown-thing" | "own-thing" | "already" | "no-perspective" | null`.

**`ThingView`** gains `title: string`, `eventDate: string | null`, `perspectives: { author: string; body: string; createdAt: string }[]`. `keeperNames` keeps its current meaning (non-creator keepers only); the shelf label becomes `"Kept together by {placedByName} & {keeperNames.join(", ")}"` per `prompt.md` §5, computed at the view layer, not stored.

## 4. HTTP route contract (extends existing routes; nothing removed)

| Route | Change |
|---|---|
| `POST /place` | form gains `title` (required, trimmed/length-limited like `body`), `event_date` (optional). Witness side-effect removed. Refusal set adds `"blank-title"`. |
| `POST /perspectives` *(new)* | form: `thing`, `house` (redirect target), `body`. Any joined member, including the creator. Publishes `publish(house, "perspective")` on success. |
| `POST /take` | unchanged path; now calls `keepTogether`; refusal set adds `"no-perspective"`; success copy becomes "Kept this together". Publishes `publish(house, "kept")`, unchanged. |
| `GET /`, `/shelf`, `/house/:slug`, `/house/:slug/room`, `/stream`, `/readme`, `/img/:slug` | unchanged. |

`REFUSALS` map in `server.ts` gains two sentences:
- `"blank-title"`: "This needs something to call it."
- `"no-perspective"`: "Write a few words about this first — keeping something together starts with your own perspective on it."

## 5. SSE / realtime (no transport change — Gate 3 deleted as a separate gate)

Reuse `publish(slug, eventName)` exactly as today. `place()` still publishes `"placed"`; `keepTogether` still publishes `"kept"`; `addPerspective` publishes a new `"perspective"` string — payload content is cosmetic, since the client resyncs on any message.

## 6. File ownership for Gate 2

| File | Change | Owner |
|---|---|---|
| `src/db.ts` | additive migration block above | Backend (DEEP) |
| `src/things.ts` | logic in §3 | Backend (DEEP) |
| `src/server.ts` | route wiring in §4 | Backend (DEEP) |
| `spec/village.test.ts`, `spec/schema.test.ts` | rewrite tests asserting the *old* auto-keep behaviour (they currently assert the mechanic being removed — this is a required rewrite, not a deletion; each rewritten test must be shown red against unmodified `main` and green against the new code, consistent with CLAUDE.md's break-to-confirm rule) | Backend (DEEP), same owner so the behavioural change and its tests land together |
| `src/render.ts` | title/event_date fields, perspectives thread, "Keep this together" button, shelf label wording | Frontend (BALANCED) — **Gate 4, starts only after this file list is implemented and typechecked** |

No two agents touch `src/things.ts` or `src/db.ts` concurrently. Given the diff's actual size (one mechanic swap in one domain file, confirmed above), the Orchestrator will execute Gate 2 directly rather than pay a delegation round-trip for a change this contained; Gate 4 (UI) is still the right size to delegate to a BALANCED-tier agent once Gate 2 is green.

## 7. Acceptance for this gate

- Schema migration applies cleanly to a DB already containing crit-9 rows (tested via a copy of a seeded DB, never the real `/data`).
- `pnpm typecheck` clean.
- `village.test.ts` + `schema.test.ts` rewritten and passing, asserting: a thing placed alone stays `IN_ROOM` regardless of who else is present; a second distinct member's perspective + explicit keep is required and sufficient; presence alone never produces a keeper; own-thing and already-kept refusals unchanged; legacy rows (no title) still read correctly.
- `keepings_not_own` and `UNIQUE(thing_id, person)` still present and still enforced (regression guard).

## 8. Deferred to Gate 6 (not decided here, scoped here)

A new dated `PROCESS.md` section, **added after** the existing crit-9 "decision this crit asks for" entry, explaining: the witness/auto-keep rule was the graded crit-9 decision (unchanged, left standing); `prompt.md`'s explicit-action rule was adopted afterward for asynchronous family use (time zones — the whole reason the rule exists per `prompt.md` §2's "important evolution"); the trade-off (losing the elegant single-mechanic simplicity of auto-keep, gaining correctness for people who are never online together). Will cite real commit hashes from Gate 2, once they exist. Not written yet.
