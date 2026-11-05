# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people: my
parents in Nghe An, my brother's family in Hanoi, me in Canberra. Four houses,
one rule — a thing you put down reaches a shelf only when somebody else adds
their own side of it. A memory is something two of you were there for.

## The app I deleted

At the crit 8 cutoff I shipped Corroborated, tagged it, and a week later
threw it away. It had one verb, and crits 9 and 10 would have been real-time
and logging bolted onto it. What survived was the idea: one person's account
and a second person's are different things, and software should not merge
them. Design before code ([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), rewrite in
[`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e), the tag keeps the old one readable.

The stack had to stop being interesting, because four-fifths of the mark is
writing: Node running TypeScript directly, no build step, one runtime
dependency, SSE because traffic is one-directional and every action is a form
POST. Measured propagation 5 ms, against the brief's 1000
([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)).

## The rule, and the one I replaced

At crit 9 everyone present when you placed something became a keeper
automatically. That was cheaper than the brief asked for: being in a room for
45 seconds is not the claim that you read what was put down and chose to keep
it. A tab left open counted.

The replacement ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)): a thing reaches the shelf only
when a distinct second person writes their own perspective on it *and*
chooses to keep it. Presence now has no write-side effect at all. The placer
can never be a keeper — enforced in code, by a trigger, and by a catch
turning the trigger's abort into a worded refusal ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)).
A rule only one layer knows can be forgotten.

## A rule I had argued for, reversed

Replacing keys with accounts broke an argument I had already written down and
tested: that any member may change any home, because *the family is one
family, however many cities it is in*. That held while a key meant "one of
us"; with registration open to whoever has the URL it does not
([`94567fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/94567fb)).

Narrowing it immediately broke something worth more. I live alone in
Canberra, and a thing reaches a shelf only when a *second* person
corroborates it — so the rule the whole app is built on would have worked for
everybody except me. One predicate became two, and the deadlock is a test
rather than a paragraph ([`ab176c7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ab176c7)).

## Where the corrections landed

The agent was not the unreliable component. I was.

**Defects in plans I wrote**, found by review rather than tests: foreign keys
inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); "who is
here" filtered by display name, so two people sharing one were each told they
were alone ([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)).

**Eleven checks that could not fail**, across five months, always the same
shape: a refusal test whose regex matched copy that renders unconditionally
([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)); a traversal test that could never fail because
`fetch` normalises the path before sending — chasing why found a real bug
three layers away, the join gate answering every unknown path `200
text/html` ([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)); assertions made vacuous by the inlined
stylesheet, which names the very classes the markup uses; a gzip q-value
parser whose obvious test sends a header with no gzip token to misparse; a
refill guard whose state cannot be reached by playing at all.

**Twice the audit itself failed**, which is the sharper finding. Breaking a
rule to confirm its test caught it, I recorded a pass: the edit had silently
not applied, so nothing was broken and the green tick attested to nothing.
And a skip link looked broken — focused, but `:focus` refusing to match —
until `document.hasFocus()` came back false: the automation window was
unfocused, so no `:focus` rule could apply anywhere. The check reproduced the
exact failure it exists to detect, one level up.

**And I verified a restyle structurally** — heading counts, no literal
colours — and shipped a page with half the layout dead
([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)). Every check passed; I had not looked at it.

## What tests could not see

The accounts work ended with 197 passing tests, typecheck clean, every new
rule broken once and confirmed red. Then I opened the app, and the first page
let me into the village while the nav still offered "Sign in": the gate asked
whether a `people` row existed for this cookie, which is a *session*, when
the question is whether it is signed in to an *account*. Every row the old
join flow left behind had one — 2148 at the time — and all of them walked
straight through. No test could catch it, because a test always starts with a
fresh cookie ([`9aea5fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/9aea5fb)).

The brief's top band for the artefact is keyboard, resize mid-interaction, a
slow connection — quoted in my design spec in October and never measured
against. The chat layout I shipped an hour earlier made the message box tab
stop 606 of 609 ([`3d14eb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3d14eb8)), and nothing was
compressed at all: 316KB a page, 31KB gzipped ([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)).

The animation added two more, both found by the *typing* spec rather than
anything aimed at them — which works only because that spec runs the real
script.

**A passing test is evidence about the test until you have seen it fail** —
and some things are only visible to somebody using the app who did not build
it.

## The one practice that paid in advance

Sowing now travels stone by stone, and CLAUDE.md had already decided how: a
JavaScript exception must be *written down there before it is built*, and the
feature must be absent rather than broken without a script. Committing the
constraints first ([`41f1471`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/41f1471)) shaped the design — the server
still renders the true board, the client only retells a move the server
recorded, and it never computes a position of its own. A test reads the final
position out of the served markup with no client at all.

Every other safeguard in this file was added after something had already gone
wrong. The shared game table is the contrast: one table, every test, so a
failure mid-test — or a person clicking around a browser — left a game seated
and the next test refused a chair. Three debugging sessions, each ending in
clearing it by hand — the re-run-until-green habit this file exists to catch. Now
verified by planting a stuck game and watching the suite recover
unaided ([`da629bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/da629bd)).

`CLAUDE.md` holds what the argument forbids; `spec/` holds what can be tested
— now 216 tests, each broken once before being trusted. Most rules exist
because a mistake taught them.
