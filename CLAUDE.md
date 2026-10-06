# Rules for this app

`README.md` is the argument; this file is what the argument forbids. If a
change would make any line here false, the change is wrong, not the line.

## What the app must never do

- **Never render a claim as corroborated unless someone other than its author
  said they saw it.** This is the product. A false "corroborated" is worse than
  no label at all, the same way a false block was worse than no check in C7.
- **The word "verified" must not appear in the interface.** The app does not
  know that. It knows how many people said they saw something, and that is a
  smaller claim — say the smaller one.
- **Never delete or hide a claim for lacking a witness.** Unwitnessed is a
  state to display, not a reason to disappear something.
- **Never drop an action silently.** Every refusal gets words explaining the
  rule. A button that does nothing teaches the user the system is broken.
- **Collect nothing beyond the pseudonym cookie.** No accounts, no email, no
  analytics. If a feature needs to know who someone really is, it's the wrong
  feature for this app.

## Rules that live in the schema, not just in code

Two invariants are enforced by the database because a code path can be
forgotten: a claim's author cannot corroborate it, and `UNIQUE (claim_id,
author)` makes one person one witness. Keep them there. If a migration would
drop either constraint, that migration is wrong.

## Checks

- **A test that has never been seen to fail is not evidence.** Before trusting
  a new test, break the behaviour it guards and confirm it goes red. Both core
  tests in `spec/claims.test.ts` were checked this way.
- **The harness needs the app running.** `spec/global-setup.ts` waits for
  `APP_URL` (default `http://localhost:8080`), so start the app, then
  `pnpm check`. It is not broken when it says nothing is answering.
- **Keep the shipped invariants as shipped.** Weakening a test to make a change
  pass is the worst available outcome.

## This repo is public

- **Never commit `.data/` or `.idea/`.** The first is the local database, the
  second records absolute paths from this checkout. Both were staged once and
  caught before pushing; both are now gitignored.
- The Fly token lives in `mise.local.toml`, which is gitignored. It never goes
  in a tracked file.

## Stack facts

- **Node runs the TypeScript directly** — no build step, no bundler. Imports
  name the file they mean, extension included (`./db.ts`). `tsc --noEmit` is
  the typecheck and never emits.
- **`/data` is the only durable storage.** One machine, one volume; there is no
  second database. `DATABASE_PATH` defaults to `/data/app.db` in the image.
- **`pnpm-workspace.yaml`'s `allowBuilds` must stay answered.** An unanswered
  entry makes `pnpm install` exit 1, and a blocked `better-sqlite3` build fails
  at boot in the image rather than at install locally.

## The page

- Colour comes from custom properties only; dark mode redefines the tokens in
  one `prefers-color-scheme` block. No literal hex in a rule body.
- Interactive targets are at least 44×44px.
- Severity and status are carried in text, never by colour alone.
- One `h1` per page; the app must work with JavaScript off.
