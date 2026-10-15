# GATE 6 — Evidence, documentation, handoff (A6-EVIDENCE)

**Status:** report for owner review. Nothing in this document has been merged into `README.md`, `CLAUDE.md`, or `PROCESS.md` — per `prompt.md` §15, those are the student's own argument and research input, and this gate proposes factual edits rather than writing them in. The owner incorporates what they want, in their own voice.

**Branch:** `prompt-rebuild`, 4 commits ahead of its `99e4c6d` base (`a6d43fd` docs brief, `99e4c6d` Gate 1 contract, `028bd5e` Gate 2, `b1393da` Gate 4, `c59a0c4` Gate 5). `main` is untouched, per the locked decision in `docs/orchestrator/gate1-contract.md`.

## 1. Factual change log

### Gate 2 — backend (`028bd5e`)

Replaced the presence-based auto-keep rule with `prompt.md` §3's explicit-action rule: a thing reaches the shelf only when a *distinct* member has written their own perspective on it and explicitly submitted "Keep this together." Presence now has no write-side effect.

Schema (`src/db.ts`, additive only, no existing column/table dropped or renamed):
- `things.title TEXT NOT NULL DEFAULT ''`, `things.event_date TEXT` (nullable) — added via a guarded `ALTER TABLE` that checks `PRAGMA table_info` before running, so it is idempotent across restarts.
- New table `perspectives(id, thing_id, author, body, created_at)` — append-only, no update path exists for it.
- New trigger `keepings_require_perspective` — `BEFORE INSERT ON keepings`, aborts unless the inserting person has a prior row in `perspectives` for that thing. Guarded so it only fires on an attempt that would otherwise succeed, so an own-thing or unknown-thing attempt still surfaces the more fundamental refusal underneath it, not this trigger's message.
- Existing `keepings_not_own` trigger and the `UNIQUE(thing_id, person)` constraint are unchanged.

Routes (`src/server.ts`): `POST /place` now accepts `title` and `event_date`; new `POST /perspectives` route; `POST /take` now requires a prior perspective from the same person (enforced at the schema layer, the route just maps the trigger's abort to a worded refusal).

### Gate 4 — frontend (`b1393da`)

Surfaced the Gate 2 rule in the UI and closed the backend/frontend gap:
- Compose form gained title and event-date fields; a perspective form and a "Keep this together" button, the latter gated by `ThingView.viewerHasPerspective` so the control itself reflects the precondition rather than only refusing after the fact.
- Shelved-thing copy: "Kept together by X & Y" (exact wording `prompt.md` expects for an `ON_SHELF` record's authors/keepers).
- Perspectives render on every thing, oldest first, with author and time.
- `ThingView.keptAt` — earliest `keepings.created_at` per thing — gives a provenance triple (event date, created date, kept date) per `prompt.md` §6, with no new column; `keepings.created_at` already carried the meaning.
- Living Village Map shows real per-house in-room/on-shelf counts.
- Shelf filters (house, year, free-text) added, backed by `shelfFor`/`shelfYears` in `src/things.ts`.

### Gate 5 — QA and security (`c59a0c4`)

Test-coverage gaps closed (see task list #7–#11): XSS through the real HTTP path for both a thing and a perspective, concurrent `keepTogether` on one identity, a same-person multi-tab route test, shelf-filter unit tests, a keyboard/landmark accessibility pass.

Two fixes from a DEEP security audit, judged actionable against the app's documented trust model (small trusted family, no accounts, presence/visibility by design — this is why three other audit findings, on forged identity, transaction boundaries, and data-access boundaries, were judged non-issues and left unchanged):
- **CSRF:** `/leave` was a GET; `SameSite=Lax` still attaches to a cross-site top-level navigation GET, so a plain link on another page could log a member out. `/leave` is now POST-only, matching every other state-changing route's plain-HTML-form convention; the nav link became a form button styled to match. `/house/:slug` was left as GET — it only marks presence, self-heals within the 45-second TTL, and converting it would cost the "every action works without JavaScript" link-based navigation for a low-severity issue.
- **SSE resource exhaustion:** `/join` has no gate, so a per-identity or per-house cap on open `/stream` connections would be trivially bypassed by minting cookies or spreading across the four houses. Added a global cap (500) across all rooms in `src/events.ts`, since each open stream holds a socket, a listener, and a `setInterval` indefinitely on the one 256MB machine.

Both fixes have a regression test and were verified red/green (reverting each in isolation produces exactly one failing, isolating test — see commit `c59a0c4` body for the exact method).

## 2. Check results (run this session, against a throwaway `DATABASE_PATH`, not `/data/app.db`)

```
$ pnpm typecheck && pnpm test
✓ tsc --noEmit — clean
✓ vitest run — 9 test files, 71 tests, all passed

$ pnpm check:evidence
✓ reflections/crit-8.md, reflections/crit-9.md
✓ PROCESS.md: 14 cited commit(s), all resolve
```

`/readme/` verified to serve the complete student-authored `README.md`: fetched the live route, parsed every `#`-level heading out of the source file, and confirmed all 5 appear in the returned HTML. Word counts: `README.md` 596 words (target 400–600), `PROCESS.md` 1150 words (target 900–1100, slightly over), `research-note.md` 887 words.

## 3. Manual browser verification performed

- Joined as a test identity, confirmed the map, the per-house counts, and the join/leave round trip render correctly.
- Clicked the restyled "Leave the village" control (now a `<button type="submit">` inside `<form method="post" action="/leave">`, not a link) and confirmed it POSTs, clears the cookie and presence, and lands back on the join page with the expected confirmation copy — the UI path, not just the HTTP-assertion path.

Not performed this session (listed honestly, per `prompt.md` §18's "say what was not tested"):
- Two simultaneous Chrome profiles side by side measuring real-time propagation visually (the <1s requirement is proven in `spec/realtime.test.ts` against the live SSE stream, at 5ms, but was not re-watched in two side-by-side browser windows this session).
- Mobile/narrow-viewport layout check.
- Screen-reader pass (a keyboard/landmark pass was done in Gate 5, task #11; a screen-reader-specific pass was not).
- Slow-connection / dropped-connection manual reconnect test.
- A conducted usability test per `prompt.md` §14's "human-judged goodness" protocol — no real participant session was run; this remains **not yet evaluated**, as the brief requires stating explicitly rather than fabricating.

## 4. Proposed edits for the owner (not applied — require the student's own voice/authorship)

**`README.md`:** No factual drift found between the README's claims and the current `spec/`-enforced behaviour; the explicit perspective-then-keep rule the README already describes (§"Putting something down is not keeping it") matches what Gate 2 implemented, it just wasn't the implementation when that paragraph was first written against the presence-era behaviour. No edit is strictly required. Optional: the "What the checks enforce" section could be extended to mention the SSE listener cap and the CSRF-guarded `/leave`, if the owner wants the README to reflect the Gate 5 security pass — this is a judgement call about scope, not a correctness fix.

**`CLAUDE.md`:** Two project invariants from this rebuild aren't yet recorded there and are candidates to add, in the owner's phrasing:
- The explicit-keep rule itself: "a keeping requires a perspective from the same person first, enforced by `keepings_require_perspective`" — the same pattern already documented for `keepings_not_own`.
- The SSE listener cap: "`src/events.ts`'s `subscribe` returns `null`, not a function, once `MAX_LISTENERS` (500) is reached — global, not per-identity, because `/join` is free."

**`PROCESS.md`:** A factual draft paragraph for the owner to adapt, documenting the Gate 5 audit and fixes (the existing 2026-10-15 entry covers the Gate 2 pivot; this would be a new, separately dated entry for Gate 5's security pass — not a rewrite of what's there):

> On [date], a security review surfaced two real gaps against the app's own threat model: `/leave` was reachable by a plain cross-site GET under `SameSite=Lax`, and `/stream` had no cap on concurrent connections despite free, ungated `/join`. Both were fixed and given regression tests, verified red before green. Three other findings (forged identity, transaction boundaries, data-access boundaries) were judged non-issues for a six-person family app with no accounts and by-design shared visibility, and left as documented trade-offs rather than "fixed."

The owner should replace `[date]` and adjust tone/detail to match the rest of `PROCESS.md`'s voice before committing it.

## 5. Outstanding before the course's definition of done is fully met

- The `prompt.md` §17 checklist's multi-browser, mobile, and usability-test items above remain unverified this session — flagged, not silently assumed passing.
- No deployment has occurred. `main` and the production Fly machine are untouched; all work is on `prompt-rebuild`, confirmed by `git branch --show-current`.
- `PROCESS.md` is 1150 words against a 900–1100 target — 50 words over, owner's call whether to trim.
