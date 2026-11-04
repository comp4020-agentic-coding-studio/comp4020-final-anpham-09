# Process overview

## What I'm building

[The village](https://comp4020-final-anpham-09.fly.dev/) is for six people:
my parents in Nghe An, my brother's family in Hanoi, me in Canberra. Four
houses, one rule — a thing you put down reaches a shelf only when somebody
else adds their own side of it. A memory is something two of you were there
for.

## The app I deleted

At the crit 8 cutoff I shipped Corroborated: claims about shared spaces, and
others saying they saw them too. It worked, it was tagged
[`crit-8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4cbb272), and a week later I threw it away. It had one verb, and
crits 9 and 10 would have been real-time and logging bolted onto it. What
survived was the idea: one person's account and a second person's are
different things, and software should not merge them. Design before code
([`fbeff16`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/fbeff16)), rewrite in [`8999e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8999e1e), tag keeps the old one readable.

## The stack, and what it cost

**Context.** `fly.toml` fixes one shared-cpu-1x machine, 256 MB, one volume
at `/data`. COMP8020 marks 35% process, 25% research note, 20% response to
the brief, 20% the app — four-fifths is writing, which is why the stack had
to stop being interesting.

**Decision.** Node 24 running TypeScript directly, no build step, no bundler,
`better-sqlite3` the only runtime dependency. Production runs the same source
the tests import.

**Server-sent events, not WebSockets.** Traffic is one-directional — the
server says what changed, every action an ordinary form POST. SSE survives
proxies and degrades to a page that stops updating, costing a
client-to-server channel this app never needed. Measured propagation: 5 ms
against the brief's 1000 ms ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)).

**What it cost.** Hand-written HTML and markdown, no component model — the
renderer alone needed four fixes once real prose went through it.

## Where the corrections landed

The agent was not the unreliable component. I was.

**Four defects were in plans I wrote**, found by review, not tests: foreign
keys inert because SQLite defaults them off ([`7fb3bc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7fb3bc2)); an unsubscribe
closing over a captured Set that could orphan a live listener ([`95aa171`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/95aa171),
[`25138b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/25138b0)); "who is here" filtered by display name, so two people
sharing one were each told they were alone ([`a2bd36b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a2bd36b)); refusals
redirecting to a 404 that cannot show them ([`976d6f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/976d6f9)).

**Four tests asserted nothing.** The refusal test's regex matched copy
rendered unconditionally, passing whether the app explained itself or
swallowed the action silently ([`4f71ee6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/4f71ee6)). Worst was a traversal test
that could never fail, since `fetch` normalises the path before sending —
chasing why found a real bug three layers away: the join gate answered every
unknown path `200 text/html` with no cookie, so the app never 404'd for a
stranger ([`7ae2670`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7ae2670)).

**Three times I prescribed a break that didn't isolate**, and each time the
implementer reported it rather than banking a convenient red.

**And I verified a restyle structurally** — heading counts, no literal
colours — reported it done, and shipped a page with mismatched card heights
and half the layout dead ([`3cbdc2e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cbdc2e)). Every check passed; I had not
looked at it. The fix needed screenshots ([`8a5a6ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8a5a6ef)).

`CLAUDE.md` holds what the argument forbids; `spec/` holds what can be
tested — now 195 tests, each broken once before being trusted. Most rules
exist because a mistake taught them: houses are allocated per test since
vitest runs spec files in parallel and presence is shared state; tests leave
on their way out since presence outlives them by 45 seconds; `README.md`
stays inside the markdown subset the app can render.

## The rule, and the one I replaced

At crit 9 everyone present when you placed something became a keeper
automatically. That was cheaper than the brief asked for: being in a room,
measured by a 45-second window, is not the claim that you read what was put
down and chose to keep it. A tab left open in the background counted.

**2026-10-15, the replacement** ([`028bd5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/028bd5e)): a thing reaches the shelf
only when a distinct second member writes their own perspective on it *and*
clicks "Keep this together." Presence now has no write-side effect at all.
The placer still can never be a keeper — enforced in `takeIn`, by a
`BEFORE INSERT` trigger, and by a catch turning the trigger's abort into a
worded refusal ([`ed8a191`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ed8a191)); `perspectives` and
`keepings_require_perspective` put the new precondition in the schema too. A
rule only one layer knows can be forgotten. "On the shelf" is derived from
whether a keeping row exists, never stored.

## 2026-10-16 — a security review, and what was worth fixing

Two real gaps: `/leave` was a GET, and `SameSite=Lax` rides along on a
cross-site GET; and `/stream` had no cap despite free `/join`, so one visitor
could open unbounded connections. Both fixed, tests red before green
([`c59a0c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/c59a0c4)). Three other findings — forged identity, transaction and
data-access boundaries — were non-issues for a six-person app with no
accounts, left as trade-offs.

## 2026-10-17 — the game the README said was cut

`README.md` named a game as the thing I most wanted and dropped: "it is a
second app." Adding it made that line false, and `CLAUDE.md`'s first rule
says the change is wrong unless the line is rewritten. So it was rewritten,
not quietly contradicted.

**Simulation decided the model, before any code.** A first draft made a quan
"one stone"; playing the six opening moves on paper scored a captured quan at
2 points instead of 11. Occupancy and value are different questions — one
decides whether a pit stops a sow, the other the score. So a
`{ dan, quan }` pair ([`2560890`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/2560890)).

**A property test earned its place immediately.** Board plus both scores is
always 70; over randomised games it produced one totalling 58 — dân sown
into a quan pit after its quan was captured, swept by nobody. No written case
had that shape. Simulation also found a missing ending: the house rules say a
player who cannot pay five points to refill has lost, nothing implemented it,
and the move was refused forever with no legal action for anyone. One game in
fifty ([`1db8238`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/1db8238)).

**Two exceptions, taken deliberately and written down.** `board_after`
stores derived state, justified by one writer, no `UPDATE` path, and a test
replaying the moves through the pure engine. The typing indicator needs
JavaScript; with a script blocked it is absent, not broken ([`b9b4f0f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b9b4f0f),
[`5cb998d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/5cb998d)).

**Three more failures of method, all mine.** I recorded breaks against a dev
server with no watcher, so three "confirmed red" results never reached the
changed code. Two assertions were vacuous because the page inlines its
stylesheet and the CSS names the same classes as the markup, so
`toContain("pit-pick")` cannot fail. One test passed half the time, reading
the first event off a stream shared with a parallel spec file. Same shape
every time — including the restyle above: a check that passes identically
whether the thing works or not.

## 2026-10-20 — keys, a log, and five checks that checked nothing

C10 wants the running app readable from outside, and what each person may see
and change decided on the server. Both were missing: any URL-holder could put
something down in any home, and the only record of an action was the row it
created. A key is not an account — no sign-up, no email, no reset, no profile
— so `README.md` and `CLAUDE.md` were rewritten rather than quietly
contradicted, the same rule as the game ([`95d9e06`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/95d9e06)).

**The rule was shipped unexercised.** 150 tests passed with no keys cut, so
`mayChange` returned on its first line and the branch refusing a visitor
never ran. Tested properly with a secret loaded, and both halves broken on
purpose first ([`1e35aec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/1e35aec)). The log had the same hole: nothing
asserted it said anything, so every call site could have been deleted
silently. The assertion that earned its place is that no line may ever
contain the cookie token, checked against the whole serialised line
([`8197d7d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/8197d7d)).

**Setting the secret for real found the worst one.** The guard checked that
`MEMBER_KEYS` parsed, not that its values were hashes, so the template pasted
with placeholders still in it counted five keys that could never verify:
every home closed, nobody able to open one. Entries are now validated and the
unusable ones named at boot, because "the secret is wrong" is not actionable
and "Dad's entry is not a hash" is ([`18e564b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/18e564b)). The same attempt
showed the key was being passed as a command-line argument, visible through
`ps` and echoed by pnpm — moved to stdin ([`560bda6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/560bda6)).

**Then the feature that existed and could not be used.** `/key` answered 200
from the first commit and nothing linked to it ([`2fabb73`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/2fabb73)).
Underneath it, `getPerson` never selected `member_name`: the key was accepted,
logged, and forgotten by the next request, so unlocking had no effect at all.
One existing test was passing *because* of that bug ([`c5c70ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/c5c70ef)).
Walking the flow in a browser found both; reading my own HTML checks found
neither.

**Test files now run one at a time.** They share one app, one database and one
table with two chairs, and in parallel they raced: four runs gave 3 failures,
0, 1, 0, against 170 passed four times sequential. The suite gates the deploy,
so a flake there eventually fails a push at the worst moment.

## 2026-10-22 — the cookie was standing in for a person

A key proves permission, not identity. Logged in with Mum's key on two
browsers, `placed_by` and `keepings.person` still held the raw cookie token —
so Mum on her phone and Mum on her laptop were two different actors, and Mum
could place a thing, then switch devices and keep it together with herself.
`keepings_not_own` compares tokens, so the trigger that exists specifically to
forbid that could not see it happen. Demonstrated against a running app before
any fix, the same discipline as the security review above
([`35e84ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/35e84ba)).

**The fix is a format, not a schema.** `placed_by`, `author`, `person` and the
two game-chair columns were already bare `TEXT` with no foreign key, so a
`person_id` — `m:<account name>` for a key-holder, `v:<cookie token>`
otherwise — slots into the same column with no migration of structure, only
of values ([`67f7ee5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/67f7ee5)). Rows written before accounts existed are
visitors by definition, so they take the `v:` prefix once, idempotently —
tested by inserting one unprefixed row and one already-migrated row, running
the migration twice, and asserting the second run changed nothing
([`3cc44ee`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3cc44ee)).

**A source guard, because the hazard is a call site slipping back, not a
behaviour a route test can see.** The route tests hit a server with no keys
cut, so every request is a visitor and a route that quietly passed the
cookie token instead of the person id would look identical from outside.
The guard reads `server.ts` itself, in three layers that fail differently: a
denylist naming the exact functions that must never see a raw token, a
residue check that strips every legitimated use of `token` and fails on
anything left over (so a renamed alias or a new call site is still caught),
and a positive pin proving each call site passes `who` rather than merely
not-`token` — otherwise the first two could pass vacuously against an empty
file ([`cb79db4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/cb79db4), [`a670846`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/a670846)). The game's two chairs
got the same treatment, since `CHECK (top != bottom)` is exactly
`keepings_not_own` with the same blind spot ([`0b82d6c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/0b82d6c)).

**One exemption, written down and dated for deletion.** The typing indicator
kept publishing a name resolved from the raw token for one task's duration,
because routing it through the person id was Task 5's job, not Task 3's. The
residue check carries a `TEMPORARY` comment naming the exact line and the
task that removes it, rather than widening the guard to let it through
unnoticed — and it was removed on schedule
([`dab8ad7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/dab8ad7)). `README.md` and `CLAUDE.md` both still said "no
accounts" after this shipped; rewritten rather than left contradicted, the
same rule as the game and the keys.

## 2026-11-04 — a rule I had argued for, reversed on purpose

Keys proved permission, not identity, and the page that took one offered a
dropdown of all five family names to anybody who loaded it. Replacing them
with registration broke an argument I had already written down and tested:
that any member may change any home, because *the family is one family,
however many cities it is in*. That held while a key meant "one of us" —
five, cut by hand. With registration open to whoever has the URL, signed-in
stops meaning family, and a home has to be its household's own. The test
pinning the old rule now asserts its opposite and carries the reason
([`94567fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/94567fb)).

**The reversal immediately broke something worth more than it.** Narrowing
"may change" to the household would have meant that nothing I put down in
Canberra could ever be kept: I live there alone, a thing reaches a shelf
only when a *second* person writes their side of it, and there is no second
person. The rule the whole app is built on would have worked for everybody
except me. So one predicate became two — `mayPlace` for starting something,
`mayRespond` for answering what is already there — and the room stopped
being hidden from guests, because you cannot write your side of something
you cannot see. The deadlock is the design's actual argument, so it is a
test rather than a paragraph ([`ab176c7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/ab176c7)).

**Three fresh ways to assert nothing, all mine, all the shape already in
this file.** The shelf renders `<li class="thing card-shelf">`, so the
room's regex could never match it. A shelf card *contains*
`<li class="perspective">`, so a non-greedy match to the first `</li>`
stops before the names — the part under test. And the stylesheet is inlined
into every page and names those same classes. Each one failed as "it never
reached the shelf" while the database said otherwise, which I only knew
because I read the row before believing the test.

**A break that reported pass because it never applied.** Counting malformed
secret entries as real codes should have gone red; it came back green. The
edit had silently not matched. The second attempt asserted that the file had
actually changed before running anything, and then three tests went red.
A check that passes identically whether or not the thing works — this time
in the harness rather than the suite.

**Two holes the new model opens, closed before they bit.** An account name
is unique for ever and its household is fixed when it is made, so the same
test name wanting two different houses across two files would be one account
with whichever ran first, the second asserting against the wrong permissions
and still passing; the house is now part of the name. And `/key` had no
rate limit at all, which mattered less when a key was one of five long
strings nobody could enumerate — a password somebody chose is guessable, so
sign-in attempts are now counted per name, not per cookie, since a cookie
is free ([`07e88ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/07e88ec)).

**Then I opened the app, and found three things 197 passing tests could
not.** The suite was green, typecheck clean, every new rule broken once and
confirmed red. The first page I looked at let me into the village while the
nav still said "Sign in" — the gate asked whether a `people` row existed for
this cookie, which is a *session*, when the question is whether it is signed
in to an *account*. Every row the old `/join` flow left behind has one and no
account: 2148 on the dev database, all of them walking straight through. No
test could catch it, because a test always starts with a fresh cookie.

Pulling that thread found a second: signing out cleared the cookie but left
`member_name` on the row, so replaying the old cookie value signed you back
in with no password. Invisible while a key was per-browser; with accounts it
is the difference between signing out and appearing to
([`9aea5fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/9aea5fb)). The third was the room offering a guest "Add a
note", anchored to a composer deliberately not rendered for them — a dead
link to the one action the house refuses. The composer was correctly hidden,
which is exactly why nothing caught it: every assertion was about the form,
none about the thing pointing at it ([`640fbef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/640fbef)).

Three for three, the same lesson as the restyle in October: the checks
answer the question you thought to ask. None of these needed a debugger or a
log — they needed one person loading the page as somebody who is not the
developer. The permission rules were right the whole time; what was wrong
was who the app thought was asking.

## 2026-11-04 — a chair nobody could leave

Reported with a screenshot rather than a stack trace: *2 seated · 1 here*,
both chairs held, no control anywhere that frees one. A seat stored a
person id and nothing tied that to whether the person was still around, and
`standUp` only ever freed your *own* chair — correct while you are there to
press it, useless the moment you are not. Two people closing a tab bricked
the table permanently.

**The fix was already in the database.** Presence knows who is in a room
and forgets them after 45 seconds; the game had simply never asked. So a
chair may be freed by anybody, but only once its occupant has gone, which
keeps it from being a way to eject somebody mid-move. Nothing played is
deleted: a game with moves in it is *stopped*, the same as standing up from
one, and its score stays on the table ([`21f1b2d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/21f1b2d)).

**My cleanup was the bug this time.** The new HTTP tests passed, then
failed on the second run. The `finally` posted `/game/stand` with no
`house` field, so it was refused silently and left the table occupied for
whatever ran next — and the meeting house has exactly one table that every
game test shares. The file's own comment warns about this. Caught by
re-running, not by reading: a test that passes once and fails after is the
same false green as one that never checked anything.

**And the chat.** The table already updated live and already showed who was
typing; what it lacked was furniture. The composer sat in the side panel,
across the page from the messages, drifting further away the more anybody
said. Moving it under the thread meant the near-bottom guard had to move
too — it measured the *document* scroll, which is no longer what scrolls,
so a reader part-way up the history would have been dragged to the bottom
on every arrival ([`56f4a55`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/56f4a55)).

**What I did not do is the part worth recording.** Making it look like
Messenger would mean bubbles, and a bubble has no room for the two-state
label or the keep-together control that every message here carries. A
remark at this table can still become a memory, and hiding that to look
more like a chat app would make the app's own argument harder to see. The
furniture changed; the argument did not.

I also guessed twice at CSS before reading it — widening a grid column that
turned out to be the wrong one, in a container that was `display: flex` and
ignoring my rule entirely. The layout was already a deliberate chat sidebar
from the Figma screens. Both guesses were reverted, and the thing that
settled it was asking the live page what it computed rather than reasoning
about the stylesheet.

## 2026-11-05 — testing the band I had only claimed

The brief's top band for the artefact is *keyboard, resize mid-interaction,
a slow connection*. I had quoted that line in the design spec in October
and never measured against it. Two of the three failed.

**The keyboard one was caused by the chat layout I had just shipped.** Every
message carries a disclosure control, so at two hundred messages the box you
type into was tab stop 606 of 609: the form worked perfectly and was
unreachable by the input method the brief names first. A skip link before the
thread fixes it at nine stops ([`3d14eb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/3d14eb8)). Only at the meeting
house — the other rooms list a handful of things, and a skip link there would
be noise in the tab order, which is the same fault pointed the other way.

**The slow-connection one was free and I had never looked.** Nothing was
compressed, and Fly's proxy does not do it for us, so every byte rendered was
a byte sent: 316KB for the meeting house. Gzip in one helper makes that 31KB
([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)). Not the event stream, which compression would
buffer — the brief's own one-second requirement would have quietly stopped
being met, and the realtime spec is how I know it did not.

**Twice the measurement lied before the code did.** The skip link looked
broken in the browser — focused, but `:focus` refusing to match — until
`document.hasFocus()` came back false: the automation window was unfocused,
so no `:focus` rule could apply anywhere on the page. And my q-value parser
was shipped untested, because the obvious test sends `accept-encoding:
identity`, a string containing no gzip token to misparse. It passes whether
the parser works or not. The case that bites is `gzip;q=0` — a client naming
gzip precisely to refuse it — and only breaking the parser and watching
nothing go red revealed that the test was not watching.

That is the fourth and fifth time this project has caught a check that could
not fail, and the second time the audit itself was the thing at fault. The
pattern is stable enough now to state plainly: a passing test is evidence
about the test until you have seen it fail.
