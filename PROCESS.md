# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people: my
parents in Nghe An, my brother's family in Hanoi, me in Canberra. Four houses,
one rule — a thing you put down reaches a shelf only when somebody else adds
their own side of it. A memory is something two of you were there for.

## The app I deleted

At the crit 8 cutoff I shipped Corroborated, tagged it, and a week later threw
it away. It had one verb, and crits 9 and 10 would have been real-time and
logging bolted onto it. What survived was the idea: one person's account and a
second person's are different things, and software should not merge them.
Design before code ([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), rewrite in [`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e), tag keeps the
old one readable.

The stack had to stop being interesting, because four-fifths of the mark is
writing: Node running TypeScript directly, no build step, `better-sqlite3` the
only runtime dependency, SSE rather than WebSockets because traffic is
one-directional and every action is an ordinary form POST. Measured
propagation: 5 ms against the brief's 1000 ms ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)).

## The rule, and the one I replaced

At crit 9 everyone present when you placed something became a keeper
automatically. That was cheaper than the brief asked for: being in a room for
45 seconds is not the claim that you read what was put down and chose to keep
it. A tab left open counted.

The replacement ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)): a thing reaches the shelf only when a
distinct second person writes their own perspective on it *and* clicks "Keep
this together". Presence now has no write-side effect at all. The placer can
never be a keeper — enforced in code, by a `BEFORE INSERT` trigger, and by a
catch turning the trigger's abort into a worded refusal ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)). A
rule only one layer knows can be forgotten.

## The reversal, and what it broke

Replacing keys with real accounts broke an argument I had already written down
and tested: that any member may change any home, because *the family is one
family, however many cities it is in*. That held while a key meant "one of
us". With registration open to whoever has the URL, signed-in stops meaning
family, and a home has to be its household's own ([`94567fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/94567fb)).

Narrowing it immediately broke something worth more. I live alone in Canberra:
a thing reaches a shelf only when a *second* person corroborates it, and there
is no second person. The rule the whole app is built on would have worked for
everybody except me. So one predicate became two — starting something is the
household's, answering what is already there is anybody's — and the room
stopped being hidden from guests, because you cannot write your side of
something you cannot see. That deadlock is the design's actual argument, so it
is a test rather than a paragraph ([`ab176c7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ab176c7)).

## Where the corrections landed

The agent was not the unreliable component. I was.

**Defects in plans I wrote**, found by review rather than tests: foreign keys
inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); "who is here" filtered
by display name, so two people sharing one were each told they were alone
([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)); refusals redirecting to a 404 that cannot show them
([`976d6f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/976d6f9)).

**Eight checks that could not fail**, across five months, always the same
shape. A refusal test whose regex matched copy that renders unconditionally,
passing whether the app explained itself or swallowed the action silently
([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)). A traversal test that could never fail because `fetch`
normalises the path before sending — chasing why found a real bug three layers
away: the join gate answered every unknown path `200 text/html`, so the app
never 404'd for a stranger ([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)). Assertions made vacuous by the
inlined stylesheet, which names the very classes the markup uses. And a
q-value parser shipped untested because the obvious test sends an
`accept-encoding` header containing no gzip token to misparse — it passes
whether the parser works or not.

**Twice the audit itself failed.** Breaking a rule to confirm its test caught
it, I recorded a pass: the edit had silently not applied, so nothing was
broken and the green tick attested to nothing. And a skip link looked broken
in the browser — focused, but `:focus` refusing to match — until
`document.hasFocus()` came back false: the automation window was unfocused, so
no `:focus` rule could apply anywhere. The check reproduced the exact failure
it exists to detect, one level up.

**And I verified a restyle structurally** — heading counts, no literal colours
— reported it done, and shipped a page with mismatched card heights and half
the layout dead ([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)). Every check passed; I had not looked at it.

## What tests could not see

The accounts work ended with 197 passing tests, typecheck clean, every new
rule broken once and confirmed red. Then I opened the app.

The first page let me into the village while the nav still offered "Sign in":
the gate asked whether a `people` row existed for this cookie, which is a
*session*, when the question is whether it is signed in to an *account*. Every
row the old join flow left behind had one and no account — 2148 of them at the
time — and
all of them walked straight through. No test could catch it, because a test
always starts with a fresh cookie. Pulling that thread found a second: signing
out cleared the cookie but left the account bound, so replaying the old cookie
signed you back in with no password ([`9aea5fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/9aea5fb)). A third followed, a dead
link offering a guest the one action the house refuses ([`640fbef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/640fbef)).

The brief's top band for the artefact is keyboard, resize mid-interaction, a
slow connection. I had quoted that in the design spec in October and never
measured against it. The chat layout I had shipped an hour earlier made the
message box tab stop 606 of 609 ([`3d14eb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3d14eb8)), and nothing was compressed
at all: 316KB a page, 31KB gzipped ([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)).

The pattern is stable enough to state plainly: **a passing test is evidence
about the test until you have seen it fail**, and some things are only visible
to somebody using the app who is not the person who built it.

`CLAUDE.md` holds what the argument forbids; `spec/` holds what can be tested
— now 216 tests, each broken once before being trusted. Most rules exist
because a mistake taught them.
