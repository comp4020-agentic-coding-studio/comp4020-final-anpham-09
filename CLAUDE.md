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
- **Anyone may register; only a household code claims a house.** An account
  is a name, a password and the household you belong to — nothing else. No
  email, no profile, no analytics, no reset, nothing kept about anyone
  beyond those three. Registering without a code is a real account that
  belongs to no house: a guest everywhere, which is the honest shape for
  somebody the family sent the URL to. This file said "no accounts, no
  passwords" until the cookie turned out to be the identity, which made one
  person with two browsers into two people and let Mum keep her own thing.
- **Never store a password.** Only a scrypt hash of one, with a per-account
  salt, so two people who choose the same password do not share a row that
  says so. There is no reset *route*, because resetting one needs an address
  to send it to and this app collects no addresses. `pnpm set-password`
  changes one by hand, on the machine, run by whoever already holds the
  database — the only person who could have edited the column anyway. It
  takes the password on stdin, never as an argument. It must never grow a
  route: the moment a password can be changed over HTTP, something has to
  prove the request came from the account's owner, and nothing here can.
- **A guest may respond, never start.** Starting something in a home is for
  the people who live in it. Writing your side of what is already there and
  keeping it together is for anybody signed in, in any house. These are two
  rules, not one, and they must not be collapsed back together: An lives
  alone in Canberra, so if responding were also the household's own, nothing
  he placed at home could ever reach his own shelf and the rule this app is
  built on would hold for everyone except him.
- **A table holds five notes a day — the TABLE's five, not each person's —
  and that is a limit on STARTING something and on nothing else.** Six
  people around one table do not get thirty notes a day between them any
  more than they get thirty plates: a surface holds what it holds, and
  whoever is there shares it. A per-person five would be a quota, which is
  something an app gives you; this is meant to be something the room has.
  Writing your side of what is already in a room, and keeping it together,
  are never capped and must never become capped: if a full table could stop
  a thing being corroborated, the one rule this app is built on would hold
  only on quiet days. Not counted at all in the meeting house, where a
  remark is not a note left on a surface — a conversation that took five
  lines a day would not be a conversation. A sixth note is refused in words
  that say where the five went, never dropped, and a full table shows that
  sentence in place of the composer rather than a form that cannot work.
- **Nothing is swept onto the note board, because nothing has to be.** A
  note is on the table if it was left today and on the board whichever day
  it was left; both are read off the timestamp the note already carries.
  There is no nightly job, no "archived" column and nothing to go wrong if
  the machine is asleep at midnight. Same reasoning as the shelf's
  `onShelf`. Do not add a flag, and do not move a row.
- **Today is UTC**, because `created_at` is UTC and a day the app and the
  database disagreed about would refuse a note for a day it was not on. One
  function answers it, `today()` in `src/things.ts`, and the count and the
  table both ask it. The cost is real and the README says so: the table
  turns over at 7am in Nghe An and Hanoi, 11am in Canberra. A local
  midnight would need a timezone stored per account, and the account is a
  name, a password and a household.
- **A photograph belongs to a memory, and there is no album of pictures on
  their own.** One picture per thing, carried with the words somebody wrote
  and reaching the shelf only when the memory does. This is the README's
  argument about photo services applied rather than abandoned: what fails
  there is keeping everything sorted by date with no idea which mattered,
  and a picture that only exists because two people agreed the moment was
  worth keeping is the opposite of that. A gallery view, a photos tab, or
  anything that lets pictures be browsed apart from their words would undo
  it.
- **The app never says what is in a photograph.** `alt` is empty and the
  picture sits in a `<figure>` whose caption is the person's own words, so
  the description a reader gets is the one somebody who was there wrote. An
  invented description is the same false label as a stand-in picture
  claiming to be the real place. If alt text is ever wanted, ask the person
  for it; do not generate it.
- **A stored photograph is named by the app, and its format is read from
  its bytes.** The filename on an upload is the one form field that arrives
  already shaped like a path, and the content-type is a claim by whoever
  sent the request. `src/photos.ts` generates the name and sniffs the magic
  number; nothing else may write into the photo directory.
- **Never claim privacy the app does not have.** The deployment is a public
  URL, and since the family's own photographs are now in the repository and
  on that URL, it is a public URL with pictures of a child on it. That was
  the owner's decision, made with the consequence in front of him; the
  README must not describe the village as private.

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
- **The HTTP tests run against a server, and which one depends on `APP_URL`.**
  CI sets it, builds the Dockerfile and starts the image with a throwaway
  `/data`, so what passes there is what deploys. With `APP_URL` unset,
  `spec/global-setup.ts` starts a server itself, on a free port and a
  throwaway database, and stops it afterwards.
  - That is not a convenience. A household table holds five notes a day per
    HOUSE, so a database that has already been used today has no room in it,
    and every placing test is refused for a reason that has nothing to do
    with what it was testing. A fresh database per run is the only
    arrangement in which the cap and the suite can both be true.
  - It also retires a footgun recorded here three times: a hand-started
    server has no watcher, so it holds the source it booted with and
    breaking a file proved nothing until it was restarted. Three "breaks"
    were recorded as isolating before that was noticed.
  - `pnpm dev` is unchanged and keeps `.data/app.db`, so the village you
    browse survives running the checks. `pnpm dev:fresh` is the same server
    on an empty one.
- **The suite has fifteen household placements a day, and spends fourteen.**
  Three household houses, five notes each, and the app is right to refuse
  the sixteenth. `spec/routes.test.ts` carries the allocation beside the
  presence one; keep it accurate. Canberra's fifth place is deliberately
  unspent, because a full table shows a sentence instead of a composer and
  two tests read that page to check where the composer is. A new test that
  must place in a household house should use the meeting house, which has
  no table and no cap, or be a unit test in `spec/village.test.ts`.
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
- **`src/multipart.ts` has no `node:http` import either**, and that one
  matters more: it is the only code in the app that parses bytes a stranger
  sent, so it has to be testable against bodies no browser would ever send.
  `spec/sources.test.ts` guards both. The parser exists at all because of
  the one-dependency rule below — a form carrying a photograph is the only
  thing in the village that is not urlencoded, and eighty lines cost less
  than a package on a 256MB machine.
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
- **A control the script has not reached yet must not look like a control.**
  Anything the script unhides carries the `hidden` attribute in the markup,
  and every rule that gives it a `display` is written `:not([hidden])` — a
  `display` declaration outranks the user agent's own rule for `[hidden]`,
  so without that the no-script page shows a "Close the book" and a pair of
  turn controls that cannot do anything. The same slip hid nothing on the
  shelf's pages and stacked all thirty-two of them behind a control reading
  "Page 1 of 32". Both were found by looking at the screen.
- State is carried in text, never by colour alone. "In the room" and "On the
  shelf" are words before they are a left border.
- One `h1` per page, and **the app must work with JavaScript off**. Every
  action is a form POST — including a game move, which is a GET to pick a pit
  and a POST to sow it. The script swaps the room and the table when the
  stream says something changed.
- **The typing indicator is one of two exceptions, and it is a whole feature
  rather than a degraded one.** With a script blocked, nothing is sent and the
  line never appears; everything else on the page behaves identically. Any
  further exception needs the same shape: the feature is absent, not broken,
  and it is written down here before it is built.
- **Sowing the board stone by stone is the second exception**, written down
  here before building it, per the rule above. The server always renders the
  true board after the move, so with a script blocked the position is simply
  correct immediately — the stones do not travel, and nothing else differs.
  The animation replays the move the server already recorded: it may never
  compute a position of its own, and the board on screen at rest is always the
  board the server sent. It is skipped entirely under
  `prefers-reduced-motion: reduce`, which is a preference about motion and not
  about information, so no words or counts live only in the animation.
- **The shelf's albums are the third exception**, written down here before
  building them. Each household's kept memories are a book: three of them
  stand closed on a shelf, and opening one takes it down into a book
  held open over the page, two pages at a time. **A page is the unit
  that turns and the unit that carries a number**, and one turn moves
  the book by ONE page: the page on the right slides across to the left
  and a new one comes down beside it. Turning by the pair instead
  replaces both sides at once, which is a slide show with a crease down
  it. Two memories to a page, numbered on the page itself so the running
  head and the spoken announcement cannot drift apart. The arrow keys
  turn it too, which is what the line along the bottom says they do.
  Where there is only room for one page, one page opens and a turn still
  moves by one.
  With a script blocked there is no shelf of covers and no spread — every
  album renders open, a heading and all of its memories, and the cover is a
  plain link down to them. Nothing is hidden behind a page that cannot be
  turned, so the shelf is still a complete, readable list of everything
  kept. The opening and the turning are skipped under
  `prefers-reduced-motion: reduce`; the book still opens and the pages still
  change, they just do not swing. No memory may ever exist only on a page
  the reader cannot reach without JavaScript.
- **A household room shows furniture, not contents, and that is the fourth
  JavaScript exception** — written down here before building it, per the
  rule above. A room has a table and a shelf. Today's notes are on the
  table, every note the room has ever held is on the note board behind it,
  and the kept memories are in the album on the shelf; you see any of them
  by going to it. The two drawers are `<dialog>` elements, which are
  ordinary open blocks until something calls `showModal()`, and the first
  thing the script does is shut them. So with a script blocked the room is
  the whole list it always was: the table open under the scene with today's
  notes and the composer in it, the board open under that with every note
  under the day it was left, and the furniture plain links down to them. No
  note may ever exist only behind a click. The board is a complete record
  including today, which is also what makes the five-a-day cap a limit on
  how fast a room fills rather than a way to lose something. The meeting
  house is exempt and must stay exempt: it is a conversation, the messages
  are the room, and putting them in a drawer would undo the argument the
  README makes for its shape.
- **A drawer is a sibling of the fragment inside it, never its parent.**
  `#room` and `#board-list` are swapped by `innerHTML` when the stream says
  something changed, and replacing the markup that CONTAINS an open
  `<dialog>` destroys the dialog and slams the drawer shut on whoever was
  reading it. Each live region is fetched and swapped on its own, which is
  why the board has a fragment route of its own.
- **The family chat is a chat, and the mock-ups keep trying to make it a
  feed.** What the meeting house takes from a design: a header saying where
  you are, a presence pill that counts the table AND names who is at it, a
  day divider wherever the day changes, bubbles, and a dot on the monogram
  of anybody still in the room. All of it comes from data the app already
  has — presence is the same presence the strip counts, and the dividers
  use the same `dayLabel` as the note board, so "Today" cannot mean two
  things in one app. What it does NOT take, however nicely drawn: hearts
  and reaction chips, voice notes, a search icon, an overflow menu, a
  free-text status beside a name ("At the stove" — the app knows which
  house you are in, not what you are doing), and a third word for a state
  that already has two ("Memory saved" is not "On the shelf"). Likes and
  tags are listed as cut in the README; a control with nothing behind it is
  the guest-hotspot bug again; and a status the app cannot know is a false
  label. This has now come up with two separate mock-ups, which is why it
  is written down rather than re-argued.
- **The meeting house has no side panel.** The two-state rule lives folded
  up in the chat header and the quiet line sits directly above the composer,
  because both are read there: one before you scroll, one as you press send.
  `spec/routes.test.ts` asserts that order.
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
- **There are two kinds of picture, and only one is a stand-in.** The house
  and scene photographs in `img/` are stock, the caption under each says so,
  and a picture that implied it was the real place would break the same rule
  as a false label. The photographs on memories are the family's own: they
  live in `img/family/` when they ship with the app and on `/data/photos`
  when they were uploaded, one route reads both, and neither is captioned as
  a stand-in because neither is one.
