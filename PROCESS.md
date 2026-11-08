# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people across Nghe An, Hanoi
and Canberra: what you put down reaches a shelf only when somebody adds
their side of it.

## The app I deleted

I shipped Corroborated at the crit 8 cutoff, tagged it, and threw it away a
week later: one verb, with crits 9 and 10 to be bolted on. What
survived was the idea — one person's account and a second person's are
different things, and software should not merge them. Design first
([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), rewrite in [`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e).

The stack had to stop being interesting, because four-fifths of the mark is
writing: Node running TypeScript directly, no build step, one dependency, SSE
over WebSockets because every action is already a form POST and the server
only has to say "something changed". Propagation measured at 5 ms against a
brief asking 1000 ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)). How the agent work is organised is its own
decision, recorded in [ADR 0001](docs/adr/0001-agent-workflow.md).

## The rule, and the one I replaced

At crit 9 everyone present when you placed something became a keeper
automatically — cheaper than the brief asked for, since being in a room for
45 seconds is not a claim that you read what was put down and chose to keep
it. A tab left open counted. The replacement ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)):  a thing reaches the shelf only
when a distinct second person writes their own perspective *and* chooses to
keep it. Presence has no write-side effect now, and the placer can never be
a keeper — enforced in code, by a trigger, and by a catch turning the trigger's abort into a worded refusal, because a rule only one
layer knows can be forgotten ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)).

## A rule I had argued for, reversed

Replacing keys with accounts broke an argument I had written down and
tested: that any member may change any home, because *the family is one
family, however many cities it is in*. That held while a key meant "one of
us"; with registration open to anyone who has the URL it does not
([`94567fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/94567fb)). Narrowing it broke something worth more:
I live alone in Canberra, so the rule the app is built on would have worked
for everybody but me. One predicate became two ([`ab176c7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ab176c7)).

## Where the corrections landed

The agent was not the unreliable component. I was.

**Defects in plans I wrote**, found by review rather than tests: foreign
keys inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); "who is
here" filtered by display name, so two people sharing one saw nobody ([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)).

**Twelve checks that could not fail**, always the same shape: a refusal test whose regex matched copy that renders always
([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)); a traversal test that could never fail because
`fetch` normalises the path before sending — chasing why found a real bug
three layers away, the join gate answering every unknown path `200
text/html` ([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)); assertions made vacuous by the inlined
stylesheet, which names the classes the markup uses; an album test that
passes whether or not pages after the first render, since a new memory lands
on page one.

**Twice the audit itself failed**, the sharper finding. Breaking a
rule to confirm its test caught it, I recorded a pass: the edit had silently
not applied, so nothing was broken and the tick attested to nothing.
And a skip link looked broken until `document.hasFocus()` came back false —
the automation window was unfocused, so no `:focus` rule could match. The check reproduced the exact
failure it exists to detect, one level up.

**And I verified a restyle structurally** — heading counts, no literal
colours — then shipped a page with half the layout dead. Every check passed; I had
not looked at it ([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)).

## What tests could not see

The accounts work ended with 197 passing tests, typecheck clean, every rule
broken once and confirmed red. Then I opened the app, and the first page let
me into the village while the nav still said "Sign in": the gate asked
whether a `people` row existed for this cookie, which is a *session*, when
the question is whether it is signed in to an *account*. Every row the old
join flow left behind had one — 2148 — and all walked straight through. No
test could catch it: a test starts with a fresh cookie
([`9aea5fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/9aea5fb)).

The brief's top band for the artefact is keyboard, resize, a slow
connection — quoted in my design spec in October, never measured. The
chat layout I shipped an hour earlier made the message box tab stop 606 of
609 ([`3d14eb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3d14eb8)), and nothing was compressed: 316KB a page, 31KB gzipped ([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)).

**A passing test is evidence about the test until you see it fail**, and
some things are only visible to somebody using the app.

## A product rule the tests could not afford

A table now holds five notes a day — the table's five, shared. The rule is four lines of SQL; the cost was the suite. Placing tests spend a house's
day and the local database is never reset, so the suite passed once a day, then failed with refusals about another
rule. CI never met
this: its `/data` is a tmpfs. The spec now starts its own server on a
throwaway database when `APP_URL` is unset, retiring the stale-source footgun above. A test then passed for the wrong reason, the
shape this file keeps finding: "the composer stays in the panel" stayed
green after the composer moved into the drawer, because it only compared positions.

## The one practice that paid in advance

Sowing travels stone by stone now, and CLAUDE.md had already decided how: a
JavaScript exception is *written down there before it is built*, and must be
absent rather than broken without a script. Committing that first
([`41f1471`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/41f1471)) shaped the design — the client only retells
a move the server recorded, never computing a position of its own.

Every other safeguard in this file was added after something had already gone
wrong. It paid again on the shelf: writing that exception down first is what
made the script's *first* act hiding pages, so a script that fails to parse
leaves the complete no-script shelf intact ([`051b372`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/051b372)), and a third time on the room's drawers. The contrast is the shared game table, where a failure left a game seated
and the next test refused a chair: three debugging sessions, each ending in
clearing it by hand — the habit this file exists to catch ([`da629bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/da629bd)).

`CLAUDE.md` holds what the argument forbids; `spec/` what can be tested —
258 tests, each broken once before being trusted.
