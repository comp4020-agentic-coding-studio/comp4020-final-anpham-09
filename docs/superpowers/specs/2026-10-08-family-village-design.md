# The village — design

Status: agreed 2026-10-08. Supersedes Corroborated (shipped and tagged `crit-8`).
Working title: *the village*. The final name should be the family's own word for
home; choosing it is a deliberate signal that the app was not generated.

## Why this replaces Corroborated

Corroborated shipped at crit 8 with a sound argument and one verb: post a claim,
say you saw it. There is no second act in it, and five more weeks of building on
something hollow would show in the writing.

What survives the pivot is the *idea*, not the app: **a thing needs a second
person.** That position is worth more in a register with warmth than in a claims
feed. `crit-8` stays tagged, so the discarded app remains in the history as
process evidence rather than as lost time.

## The argument

A family lives in three households in different places. They already have a
group chat, so reaching each other is not the problem. The problem is that
nothing survives it: an eleven-month-old's entire first year is somewhere in a
scroll nobody will ever go back through. Photo services solve this by keeping
everything, which is the same failure from the other side — forty thousand files
sorted by date by a machine that does not know which ones matter.

Sharing is easy. Keeping is hard. This app is about the second one.

> **A memory is something two of you were there for.**

Placing something is not keeping it. A thing becomes part of a house only when
someone other than the person who placed it was in the room. That person's name
goes on it beside theirs.

This is the same spine as Corroborated — one person's account is not the same as
a second person's — moved somewhere it means something.

## What the app is

A village of four places: three household homes (parents; brother,
sister-in-law and nephew; mine) and a meeting house. A map shows all four, and
shows who is in which one, right now.

You go into a house. You see who else is there and what is in the room. You can
put something down: a few words, and later a photo. Whoever else is in the room
at that moment becomes a keeper of it, and it goes on the house's shelf
permanently, with both names and the date.

Place something with nobody else there and it stays where you put it, visible,
indefinitely. It simply is not on the shelf yet. Anyone who comes in later can
take it in, and then it is.

### Two layers

- **In the room** — everything placed, oldest to newest, nothing hidden.
- **On the shelf** — things that two or more people were present for. Permanent,
  named, dated. This is what the family comes back to.

Nothing anyone places is ever deleted and nothing placed expires. The one
mutable exception is `presence`, which is live state rather than something
someone put down — see Real-time. The rule is additive: being
together makes things permanent; being alone takes nothing away.

### The nephew

He is eleven months old and the reason the app exists; he is also the only
family member who cannot operate it. He does not keep things — the app will not
pretend an infant witnessed anything. Things *about* him are placed and kept by
the adults, and every shelf entry records who chose to keep it. In twenty years
the shelf shows him his first year and which of them cared enough to keep each
piece of it.

## Rules the app must never break

These go into `CLAUDE.md` once agreed.

- **Never show a thing on the shelf with only one name on it.** A single
  person's record of something is a different object from a shared one, and the
  app must not collapse them. This is the product.
- **Never delete or expire anything.** A room keeps what is in it.
- **Never say "saw".** The app knows who was present in a room, which is a
  smaller claim than who looked. Say the smaller one: "N people were here".
- **Never let someone keep their own thing**, by any path, including a replay of
  the same request.
- **Collect nothing beyond a chosen name in a cookie.** No accounts, no
  passwords, no email, no analytics.
- **Never claim privacy the app does not have.** The deployment is a public URL.
  The README must say so plainly rather than implying the village is sealed.

## Data model

SQLite at `/data/app.db`, WAL, via `better-sqlite3` — unchanged from the current
`src/db.ts`. Four tables.

```
houses    (id, slug, name, kind)              -- 'home' | 'meeting'; seeded, not user-created
people    (token PK, name, home_slug, created_at)
things    (id, house_id FK, placed_by FK, body, created_at)
keepings  (id, thing_id FK, person FK, created_at,
           UNIQUE (thing_id, person))
presence  (person PK, house_id FK, last_seen)
```

Two invariants live in the schema rather than only in a code path, following
the pattern already proven in Corroborated:

- `UNIQUE (thing_id, person)` — one person is one keeper however many times they
  act.
- A trigger rejects any `keepings` row whose `person` equals the thing's
  `placed_by`. SQLite cannot express this as a plain `CHECK` across tables, so
  it is a `BEFORE INSERT` trigger that raises.

A thing is *on the shelf* iff it has at least one `keepings` row. There is no
boolean column for it; the state is derived, so it cannot drift.

`presence` is a small mutable table, the only non-append-only one. Everything
else is append-only, which also gives crit 10's logging work something honest to
read from.

## Real-time

Server-sent events, one `GET /stream` per open session. Expected concurrency is
the family (about six) plus a crit room (about eight) plus two marker windows —
well inside what one `shared-cpu-1x` with 256MB holds. SSE over WebSockets
because the traffic is one-directional (the server tells you what changed;
actions go over ordinary form POSTs), it survives proxies, and it degrades to
nothing rather than to a broken page. `PROCESS.md` records this choice and the
alternatives weighed.

**Presence** is written on every page load and refreshed while an SSE connection
is open, with a 45-second TTL. A visitor with JavaScript disabled is therefore
present for 45 seconds after loading a page — real, briefly, which is the honest
behaviour and is also why the interface says "was here" rather than "saw".

**Keeping at placement time:** when A posts a thing to house H, the server reads
everyone present in H within the TTL, excluding A, and writes a `keepings` row
for each. Later arrivals can take a thing in with a button, which is the same
insert.

**Without JavaScript** the app still works: pages are server-rendered, placing a
thing is a form POST followed by a redirect, and taking something in is a button
in a form. What is lost is only live updating — you see the room as it was when
the page loaded.

## Identity

Arrive, choose a name, pick which house is yours. A token in a cookie; nothing
else. The existing `readCookie` / `newToken` helpers in `src/identity.ts` carry
over; the generated-pseudonym part is replaced by a chosen name, because the
family are specific people and "wandering rosella" would undo the whole point.

No door and no password. The brief leaves who counts as a person open, and a
gate would block the marker and the crit room while providing no real privacy on
a public URL. The README states this directly.

## What is enforced, and what is judged

The README must say which is which; the rubric rewards it.

**Enforced in `spec/`:**

- A thing with no keeper never renders on the shelf.
- A person cannot keep their own thing, through any route.
- One person keeping twice counts once.
- A thing placed while someone else is present is on the shelf immediately, with
  both names.
- Things, keepings and shelves survive a restart.
- A thing can be placed with JavaScript off, via form POST.
- A change in one session reaches a second open session in under a second.

Each test is to be checked by breaking the behaviour it guards and confirming it
goes red before it is trusted — the practice already established in `CLAUDE.md`.

**Judged, not testable:**

- Whether the village reads as a place rather than a menu.
- Whether the shelf is something the family would actually come back to.
- Whether the distinction between the room and the shelf is legible to someone
  who has not read the rules.

## Not building

Accounts and passwords. Direct messages. Notifications of any kind. Games.
A calendar, chores, or wish lists. Avatar customisation, outfits, pets. Decor
editing. Voice or video. Drag-and-drop. An illustrated isometric canvas — the
village is CSS and real DOM elements, because the top band of the artefact
criterion is keyboard, resize mid-interaction and a slow connection, and a
canvas fails all three.

## Delivery

- **Crit 9 — cutoff Wednesday 14 October 2026, 13:30 Canberra** (group Liuru, session Wed 15:30–17:00, Marie Reay 4.03). Map, four houses, choose a name, live presence,
  place a note (text only), the witness rule, shelf and room, SSE. Deployed by
  the cutoff. The written-down multi-person decision the crit spec asks for *is*
  the witness rule. Plus `reflections/crit-9.md` and a rewritten `PROCESS.md`.
- **Crit 10 — cutoff Wednesday 21 October 2026, 13:30 Canberra.** Server-side logging, which is the crit's own
  topic and reads naturally off the append-only tables. Photos, with a hard size
  cap, stored under `/data`.
- **Final — due 2026-11-09 noon.** The warm visual direction in CSS; the shelf
  as something worth revisiting; robustness for the top artefact band. `README.md`
  rewritten to 400–600 words.

Running alongside, and forced by nothing: `research-note.md`, 600–800 words,
25% of the project mark. Reading starts week 10.

## Risks

- **Six days to crit 9.** The slice above is the minimum that still carries the
  whole argument. If it slips, the thing to cut is the map's prettiness, never
  the witness rule.
- **Text-only at crit 9 may read thin.** Accepted: real-time presence plus the
  witness rule is the thesis, and photos are a crit-10 addition that changes no
  rules.
- **Presence TTL makes "was here" approximate.** Mitigated by never claiming
  more than presence in the wording.
- **A second pivot would be fatal.** This is the last concept change; everything
  after today is building and writing.
