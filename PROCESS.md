# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people: my
parents in Nghe An, my brother's family in Hanoi, and me in Canberra. Four
houses you walk into, and one rule — a thing you put down reaches a house's
shelf only when somebody else was in the room. A memory is something two of you
were there for.

## The app I deleted

At the crit 8 cutoff I shipped Corroborated: claims about shared spaces, and
other people saying they saw them too. It worked, it was tagged
[`crit-8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4cbb272), and a week later I threw it away.

It had one verb. Post a claim, say you saw it. Crits 9 and 10 would have been
real-time and logging bolted onto a complete interaction, and the brief marks
down features with no reason to exist. What survived the pivot was the idea
rather than the app: one person's account and a second person's are different
things, and software should not merge them. That sentence is worth more in a
family's house than in a claims feed.

The design went in before the code ([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), the rewrite
landed in [`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e), and the tag keeps the discarded version
readable. Fifty-three commits since.

## The stack, and what it cost

**Context.** `fly.toml` fixes one shared-cpu-1x machine, 256 MB, one volume at
`/data`. No second database. For COMP8020 the marks are 35% process, 25%
research note, 20% response to the brief, 20% the deployed app — four-fifths is
argument and writing, which is why the stack had to stop being interesting.

**Decision.** Node 24 running TypeScript directly — no build step, no bundler —
with `better-sqlite3` as the only runtime dependency. What runs in production is
the same source the tests import.

**Real-time: server-sent events, not WebSockets.** The traffic is
one-directional: the server says what changed, and every action is an ordinary
form POST. SSE survives proxies, and when it fails it degrades to a page that
doesn't update rather than one that breaks. The cost is no client-to-server
channel, which this app never needed. Measured propagation is 5 ms against the
brief's 1000 ms ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)).

**What it cost.** Hand-written HTML strings, hand-written markdown for
`/readme/`, no component model. The markdown renderer alone needed four fixes
once real prose went through it.

## The decision this crit asks for

**Everyone present when you place something becomes a keeper, automatically.**
Later arrivals take it in by hand. The placer never can — enforced in `takeIn`,
again by a `BEFORE INSERT` trigger, and a third time by a catch that turns the
trigger's abort back into a worded refusal ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)). A rule
only one layer knows is a rule that can be forgotten.

"On the shelf" is derived from whether a keeping row exists, never stored. There
is no boolean to drift away from the fact underneath it.

## Where the corrections landed

The agent was not the unreliable component. I was.

**Four defects were in plans I wrote**, found by review rather than by tests,
and each fix went into the plan rather than a retry: foreign keys that were
inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); an unsubscribe
that closed over a captured Set and could permanently orphan a live listener
([`95aa171`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/95aa171), [`25138b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/25138b0)); "who is here" filtered by
display name, so two people sharing a name each subtracted the other and both
were told they were alone ([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)); and refusals redirecting to
a 404 page that cannot show them ([`976d6f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/976d6f9)).

**Four tests were found to assert nothing**, every one caught by the rule in
`CLAUDE.md`: break what it guards, confirm it goes red. The refusal test's regex
also matched copy that renders unconditionally, so it passed whether the app
explained itself or swallowed the action silently ([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)). The
worst was a traversal test that could not fail at all, because `fetch`
normalises the path before sending. Chasing why it could not fail found a real
bug three layers away: the join gate answered every unknown path with
`200 text/html` to anyone without a cookie, so the app never 404'd for a
stranger ([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)).

**Three times I prescribed a break that didn't isolate** — a changed placeholder
count, a flipped comparison, a deleted insert — and each time the implementer
reported the non-isolation instead of banking a convenient red. "A break only
counts if it isolates" is now a rule in `CLAUDE.md` because of those rounds.

## What I got wrong this week

I verified the restyle structurally — heading counts, no literal colours, no
invented content — reported it done, and shipped a page with mismatched card
heights and half the layout dead ([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)). Every check passed.
I had not looked at it. The fix needed screenshots, not assertions
([`8a5a6ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8a5a6ef)), and `CLAUDE.md` now carries a section called
"Looking, not just checking".

The same shape as the vacuous tests: a check that passes identically whether the
thing works or not.

## What the harness enforces now

`CLAUDE.md` holds what the argument forbids; `spec/` holds what can be tested —
59 tests, each broken once before being trusted. Some of its rules exist only
because a mistake taught them: houses are allocated per test because vitest runs
spec files in parallel and presence is shared state; tests leave on their way out
because presence outlives them by 45 seconds; `README.md` must be written inside
the markdown subset the app can actually render.

## 2026-10-15 — presence stopped being enough

The decision two sections up — "everyone present when you place something
becomes a keeper, automatically" — is no longer what the app does. It was a
cheaper rule than the brief asked for: being in the same room at the same
moment, measured by a 45-second presence window, is not the same claim as
having read what was put down and chosen to keep it. A tab left open in the
background counted as a keeper under the old rule. It shouldn't have.

The replacement ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)):
a thing reaches the shelf only when a distinct second member has written
their own perspective on it *and* explicitly clicked "Keep this together."
Presence now has no write-side effect at all — it's purely what the Living
Village Map and a house's who's-here line show, never what moves something
onto the shelf. The `keepings` table and its `keepings_not_own` trigger are
unchanged; a new `perspectives` table and `keepings_require_perspective`
trigger enforce the added precondition at the schema layer, not just in the
route — the same "enforced twice" pattern the placer-exclusion rule already
used, for the same reason: a rule only one layer knows is a rule that can be
forgotten.

This is not a correction to the crit 9 write-up above — that entry describes
what was true and shipped at the time, and stands as written. It's a later
decision, made against the original brief's §3 rather than against anything
that went wrong in testing.
