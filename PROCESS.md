# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people: my
parents in Nghe An, my brother's family in Hanoi, and me in Canberra. Four
houses, one rule — a thing you put down reaches a house's shelf only when
somebody else was in the room. A memory is something two of you were there
for.

## The app I deleted

At the crit 8 cutoff I shipped Corroborated: claims about shared spaces, and
other people saying they saw them too. It worked, it was tagged
[`crit-8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4cbb272), and a week later I threw it away.

It had one verb: post a claim, say you saw it. Crits 9 and 10 would have been
real-time and logging bolted onto that, and the brief marks down features
with no reason to exist. What survived the pivot was the idea, not the app:
one person's account and a second person's are different things, and
software should not merge them.

The design went in before the code ([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), the rewrite landed in
[`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e), and the tag keeps the discarded version readable. Fifty-three
commits since.

## The stack, and what it cost

**Context.** `fly.toml` fixes one shared-cpu-1x machine, 256 MB, one volume at
`/data`. No second database. COMP8020 marks 35% process, 25% research note,
20% response to the brief, 20% the deployed app — four-fifths is argument and
writing, why the stack had to stop being interesting.

**Decision.** Node 24 running TypeScript directly, no build step, no bundler,
`better-sqlite3` the only runtime dependency. Production runs the same source
the tests import.

**Real-time: server-sent events, not WebSockets.** Traffic is one-directional
— the server says what changed, every action an ordinary form POST. SSE
survives proxies and degrades to a page that stops updating, costing a
client-to-server channel this app never needed. Measured propagation: 5 ms
against the brief's 1000 ms ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)).

**What it cost.** Hand-written HTML strings, hand-written markdown, no
component model — the markdown renderer alone needed four fixes once real
prose went through it.

## The decision this crit asks for

**Everyone present when you place something becomes a keeper, automatically.**
Later arrivals take it in by hand; the placer never can — enforced in
`takeIn`, again by a `BEFORE INSERT` trigger, and a third time by a catch that
turns the trigger's abort into a worded refusal ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)). A rule only
one layer knows is a rule that can be forgotten.

"On the shelf" is derived from whether a keeping row exists, never stored —
no boolean to drift away from the fact underneath it.

## Where the corrections landed

The agent was not the unreliable component. I was.

**Four defects were in plans I wrote**, found by review, not tests: foreign
keys inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); an unsubscribe
closing over a captured Set that could permanently orphan a live listener
([`95aa171`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/95aa171), [`25138b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/25138b0)); "who is here" filtered by display name, so two
people sharing a name each subtracted the other and both were told they were
alone ([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)); and refusals redirecting to a 404 page that cannot show them
([`976d6f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/976d6f9)).

**Four tests asserted nothing**, each caught by the `CLAUDE.md` rule: break
what it guards, confirm it goes red. The refusal test's regex also matched
copy rendered unconditionally, passing whether the app explained itself or
swallowed the action silently ([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)). Worst was a traversal test that
could never fail, since `fetch` normalises the path before sending — chasing
why found a real bug three layers away: the join gate answered every unknown
path `200 text/html` with no cookie, so the app never 404'd for a stranger
([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)).

**Three times I prescribed a break that didn't isolate** — a placeholder
count, a flipped comparison, a deleted insert — and each time the implementer
reported the non-isolation rather than banking a convenient red. "A break only
counts if it isolates" is now a `CLAUDE.md` rule because of those rounds.

## What I got wrong this week

I verified the restyle structurally — heading counts, no literal colours, no
invented content — reported it done, and shipped a page with mismatched card
heights and half the layout dead ([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)). Every check passed; I had not
looked at it. The fix needed screenshots, not assertions ([`8a5a6ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8a5a6ef)), and
`CLAUDE.md` now carries "Looking, not just checking" — the same shape as the
vacuous tests: a check passing identically whether the thing works or not.

## What the harness enforces now

`CLAUDE.md` holds what the argument forbids; `spec/` holds what can be
tested — 59 tests, each broken once before being trusted. Some rules exist
only because a mistake taught them: houses are allocated per test since
vitest runs spec files in parallel and presence is shared state; tests leave
on their way out since presence outlives them by 45 seconds; `README.md`
stays inside the markdown subset the app can render.

## 2026-10-15 — presence stopped being enough

The decision two sections up — "everyone present when you place something
becomes a keeper, automatically" — is no longer what the app does. It was
cheaper than the brief asked for: being in the same room, measured by a
45-second presence window, is not the same claim as having read what was put
down and chosen to keep it. A tab left open in the background counted as a
keeper under the old rule. It shouldn't have.

The replacement ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)): a thing reaches the shelf only when a distinct
second member has written their own perspective on it *and* explicitly
clicked "Keep this together." Presence now has no write-side effect — purely
what the map and a house's who's-here line show, never what moves something
onto the shelf. The `keepings` table and `keepings_not_own` trigger are
unchanged; a new `perspectives` table and `keepings_require_perspective`
trigger enforce the precondition at the schema layer, not just the route —
the same "enforced twice" pattern the placer-exclusion rule already used.

This is not a correction to the crit 9 write-up above — that entry stands as
written. It's a later decision, against the brief's §3 rather than anything
that went wrong in testing.

## 2026-10-16 — a security review, and what it was worth fixing

A security review found two real gaps: `/leave` was a GET, and `SameSite=Lax`
rides along on a cross-site GET; and `/stream` had no cap despite free
`/join`, so one visitor could open unbounded connections. Both fixed, with
regression tests verified red before green ([`c59a0c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/c59a0c4)). Three other
findings — forged identity, transaction and data-access boundaries — were
non-issues for a six-person family app with no accounts, left as trade-offs.
