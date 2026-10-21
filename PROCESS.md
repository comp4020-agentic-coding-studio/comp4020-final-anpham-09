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
tested — now 150 tests, each broken once before being trusted. Most rules
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
