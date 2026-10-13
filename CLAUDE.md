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
underneath it. Do not add one.

## Checks

- **A test that has never been seen to fail is not evidence.** Break the
  behaviour it guards, confirm it goes red, restore. Four tests in this repo
  did not go red and were rewritten: they were asserting nothing.
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

## The page

- Colour comes from custom properties only; dark mode redefines the tokens in
  one `prefers-color-scheme` block. No literal colour in a rule body.
- Interactive targets are at least 44×44px, including nav links.
- State is carried in text, never by colour alone. "In the room" and "On the
  shelf" are words before they are a left border.
- One `h1` per page, and **the app must work with JavaScript off**. Every action
  is a form POST; the only script is the event stream that swaps the room.
- **`/readme/` renders through `src/render.ts`'s own markdown**, which supports
  headings, paragraphs, lists, blockquotes, fenced code and inline
  bold/italic/code/links — and nothing else. Write `README.md` inside that
  subset, with exactly one `#` heading.
- **House pictures are stand-ins** until the family takes real ones, and the
  caption under each says so. A picture that implies it is the real place when
  it is not breaks the same rule as a false label.
