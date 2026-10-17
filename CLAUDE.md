# Rules for this app

`README.md` is the argument; this file is what the argument forbids. If a
change would make any line here false, the change is wrong, not the line.

## What the app must never do

- **Never show a thing on the shelf with only one name on it.** One person's
  record of something and a thing two people were there for are different
  objects, and the app must not collapse them. This is the product.
- **Never delete or expire anything anyone placed.** A thing placed alone is
  not a failure state. It stays in the room, visible, indefinitely.
- **Never let someone keep their own thing**, by any path, including a replayed
  request or a hand-made POST.
- **Never say "saw".** The app knows who was *here*, which is a smaller claim
  than who looked. Say the smaller one.
- **Never drop an action silently.** Every refusal gets words explaining the
  rule. A button that appears to do nothing teaches the user the system is
  broken; being told the rule teaches them the rule.
- **Collect nothing beyond a chosen name in a cookie.** No accounts, no
  passwords, no email, no analytics.
- **Never claim privacy the app does not have.** The deployment is a public
  URL. The README says so plainly rather than implying the village is sealed.

## Rules that live in the schema, not just in code

Two invariants are enforced by the database because a code path can be
forgotten: the `keepings_not_own` trigger rejects a keeping by whoever placed
the thing, and `UNIQUE (thing_id, person)` makes one person one keeper. Keep
them there. A migration that drops either is wrong.

The own-thing rule is enforced three times on purpose — the trigger, a check in
`takeIn`, and a catch that maps the trigger's abort back into a worded refusal.
The third exists because the trigger's error text is not a sentence a person
should ever read.

**"On the shelf" is derived, never stored.** A thing is kept if and only if a
`keepings` row exists for it. There is no boolean to drift away from the fact
underneath it. Do not add one. The same reasoning governs whether a game has
been written down: that is a `things` row with a `game_id`, not a flag on the
game.

The game adds four more, for the same reason: `one_live_game_per_house` is a
partial unique index, because two live games would give the room two boards
and no way to say which one "the table" means; `CHECK (top != bottom)` is the
game's own placer-exclusion rule, since a game needs two of you; and
`moves_never_change` and `moves_never_vanish` make a played move permanent,
which is "never delete anything anyone placed" applied to a move.

**`moves.board_after` is the one piece of derived state that IS stored**, and
it is an argued exception rather than a lapse. The shelf's `onShelf` is
derived because there is a fact underneath it that a cached boolean could
drift from. A board has no such fact: the move list is its only source, and
replaying every move on every render costs CPU on a 256MB box for no
integrity gain. What makes it honest is that it has exactly one writer — the
engine, in the same `INSERT` as the move that produced it — no `UPDATE` path
at all, and a test in `spec/games.test.ts` that replays the moves through the
pure engine and asserts it reproduces every stored board and every stored
score. Remove that test and the exception stops being defensible.

## Checks

- **A test that has never been seen to fail is not evidence.** Break the
  behaviour it guards, confirm it goes red, restore. Several tests in this
  repo did not go red and were rewritten: they were asserting nothing.
- **The HTTP tests run against a server that is already running.** `pnpm dev`
  is plain `node src/server.ts` with no watcher, so breaking a source file
  proves nothing until the server is restarted. Three "breaks" were recorded
  as isolating before this was noticed; the process under test still held the
  unbroken source.
- **Never assert on a page without stripping the stylesheet first.** Every
  page inlines the whole of it, and it names the same classes the markup uses
  — so `toContain("pit-pick")` can never fail and `not.toContain` can never
  pass. The first is the dangerous direction: it stays green while the feature
  is broken. `spec/routes.test.ts` has a `markup()` helper; use it.
- **A test that asserts on the CONTENT of an event must wait for ITS event.**
  Houses are shared across spec files running in parallel, so the first event
  on a stream may belong to another test. `firstEvent` is right for proving
  delivery; `firstEventMatching` is right for anything that reads the payload.
  This was found as a suite that failed half the time and passed alone.
- **A break only counts if it isolates.** A break that reddens tests it has
  nothing to do with has not proved what it claims. If a break reddens more or
  fewer tests than expected, that is a finding about the tests — report it
  rather than making it fit.
- **Some things cannot be tested through a normal client.** A traversal test
  using `..` cannot fail, because `fetch` normalises the path before sending.
  Test the character class instead, and say so in a comment.
- **Houses are allocated per test and are not interchangeable.** `vitest` runs
  spec files in parallel and presence is shared server state, so two tests in
  one house witness each other's placements. The comment tables in
  `spec/routes.test.ts` and `spec/realtime.test.ts` carry the allocation. Do
  not consolidate them.
- **Tests leave on their way out.** Presence outlives a test by the 45-second
  TTL; a leftover witness silently shelves the next run's placement.
- **The harness needs the app running.** `spec/global-setup.ts` waits for
  `APP_URL` (default `http://localhost:8080`). It is not broken when it says
  nothing is answering.
- **Keep the shipped invariants as shipped.** Weakening a test to make a change
  pass is the worst available outcome.

## Looking, not just checking

Structural checks pass on pages that look broken. The first restyle had correct
heading counts, no literal colours and no invented content, and shipped with
mismatched card heights and half the layout dead. Take a screenshot and look at
it before calling a visual change done.

## This repo is public

- **Never commit `.data/`, `.idea/`, or anything under `.superpowers/`.** The
  first is the local database, the second records absolute paths, the third is
  scratch. A `.gitignore` added after a file is already tracked does not
  untrack it.
- The Fly token lives in `mise.local.toml`, which is gitignored. It never goes
  in a tracked file.

## Stack facts

- **Node runs the TypeScript directly** — no build step, no bundler. Imports
  name the file they mean, extension included (`./db.ts`). `tsc --noEmit` is
  the typecheck and never emits.
- **`/data` is the only durable storage.** One machine, one volume; there is no
  second database. `DATABASE_PATH` defaults to `/data/app.db` in the image.
- **`better-sqlite3` is the only runtime dependency.** Adding a second needs a
  reason that survives 256MB.
- **The Dockerfile copies named paths.** `src/`, `README.md` and `img/` are in
  the image because they are listed. A new directory the app reads at runtime
  must be added there, or it works locally and 404s in production.
- **`pnpm-workspace.yaml`'s `allowBuilds` must stay answered.** An unanswered
  entry makes `pnpm install` exit 1.
- **Presence has a 45-second TTL**, named once in `src/presence.ts`. It is one
  row per person, so two tabs on different houses flip that person's location.
  Known, documented in the README, not silently worked around.
- **`src/events.ts` has no `node:http` import.** That is what makes real-time
  testable without starting a server. Keep it that way.
- **`src/oanquan.ts` has no imports at all.** The rules are pure functions
  over a board value, which is what lets the conservation property test play
  thousands of games with no database and no server. An import of `./db.ts`
  would fail no test — it would quietly make the engine untestable in
  isolation. `spec/sources.test.ts` guards both this and the rule above.
- **Points are conserved: board + both scores is always 70.** That property,
  run over hundreds of randomised games, found a real engine bug that no
  hand-written case had. Keep the property test.
- **A game has three endings, not two.** `finished` (both quan captured) and
  conceding when a side cannot afford to refill both produce a real score and
  can be kept. `stopped` — somebody walked away — produces no score, no
  winner, and nothing to put in a room. The interface must not offer to keep
  one, and absence is the right way to do that: a button that refuses teaches
  people the app is broken.

## The page

- Colour comes from custom properties only; dark mode redefines the tokens in
  one `prefers-color-scheme` block. No literal colour in a rule body.
- Interactive targets are at least 44×44px, including nav links.
- State is carried in text, never by colour alone. "In the room" and "On the
  shelf" are words before they are a left border.
- One `h1` per page, and **the app must work with JavaScript off**. Every
  action is a form POST — including a game move, which is a GET to pick a pit
  and a POST to sow it. The script swaps the room and the table when the
  stream says something changed.
- **The typing indicator is the one exception, and it is a whole feature
  rather than a degraded one.** With a script blocked, nothing is sent and the
  line never appears; everything else on the page behaves identically. Any
  further exception needs the same shape: the feature is absent, not broken,
  and it is written down here before it is built.
- **A typing event must never trigger a resync.** The SSE contract is "any
  event means refetch", and the payload has always been an opaque string the
  client ignores. The client branches on the `typing:` prefix and returns;
  everything else falls through unchanged. Resyncing here would be a request
  per keystroke from everyone in the room, and would wipe a half-written
  message out of the box.
- **A payload is one SSE `data:` line, so it may not contain a newline.** A
  newline does not escape — it ends the line, and what follows is parsed as a
  further event under the control of whoever wrote it. Every payload was a
  literal in this codebase until typing started carrying a person's name.
  `publish()` sanitises, which is the one place every payload passes through;
  do not sanitise at call sites instead.
- **`/readme/` renders through `src/render.ts`'s own markdown**, which supports
  headings, paragraphs, lists, blockquotes, fenced code and inline
  bold/italic/code/links — and nothing else. Write `README.md` inside that
  subset, with exactly one `#` heading.
- **House pictures are stand-ins** until the family takes real ones, and the
  caption under each says so. A picture that implies it is the real place when
  it is not breaks the same rule as a false label.
