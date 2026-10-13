# Research note — sources brief (An writes the note)

600–800 words, 25% of the final project. HD = "a clear position, argued and
defended: sources weighed against each other and put to work, the counter-case
met, and the note scoped tightly enough to carry one argument to its end."

Course guidance on reading practitioner writing: **"situate the claim, weigh its
evidence, notice what it's selling."** The note is marked on how you read, not
how much. Four or five sources used hard beats ten summarised.

It argues what good practice looks like **in the field**. An argument that
doesn't reach beyond this project belongs in PROCESS.md instead.

## The position available to you

> The bottleneck in agentic development has moved from generation to
> verification, and the practices that matter are the ones that make a human's
> checking cheaper and more honest — not the ones that make the agent faster.

Stronger, and what makes it a position rather than a topic:

> **A check that passes identically whether or not the thing works is worse
> than no check, because it manufactures confidence.** Agentic workflows
> multiply these, because agents generate tests as readily as code, and a
> generated test's default failure mode is vacuous truth.

This is defensible, non-obvious, and it is what the project actually found.

## Scholarly spine — the two that make it a research note

**Bainbridge, L. (1983). "Ironies of Automation." *Automatica* 19(6), 775–779.**
Automating the easy part leaves the human monitoring a system they no longer
practise operating — and monitoring is the task humans are worst at. ~1,800
citations by 2016 and still climbing. Use for: the reviewer's skill is what
keeps atrophying precisely as it becomes load-bearing.

**Parasuraman, R., & Manzey, D. (2010). "Complacency and Bias in Human Use of
Automation: An Attentional Integration." *Human Factors* 52(3), 381–410.**
Distinguishes complacency (relying on automated advice) from automation bias
(adopting it without independent verification). Critically: it occurs in
experts as well as novices, worsens under cognitive load, and **cannot be
trained away by instruction alone**. Open PDF at TU Berlin DepositOnce.
Use for: the counter-argument to "just tell developers to check the output" —
the literature says that does not work, which is why it has to be structural.

## Empirical evidence — and the one to handle carefully

**METR (2025), randomised controlled trial.** 16 experienced open-source
developers, 246 real tasks on their own mature repositories, randomised to
AI-allowed or AI-disallowed. Result: **19% slower with AI**, while the same
developers estimated afterwards they had been **20% faster** — a ~39-point gap
between perception and measurement. Screen recordings showed time moving from
coding into reading and verifying output.

**Handle with care, and say so in the note — this is where "weigh its evidence"
is demonstrated.** n=16. Early-2025 tooling (Cursor Pro, Claude 3.5/3.7). METR
itself labels the result historical. GitHub's Copilot study found 55% *faster*
on a defined task; DORA finds 80%+ self-reported gains. The honest reading is
not "AI makes you slower" — it is that **self-report is unreliable about
verification cost**, which is the only claim you need and the one the design
supports. A note that cites the 19% as a settled fact marks down; one that
names the n, the tooling date and the conflicting studies marks up.

## Practitioner writing — the field's own literature

**Simon Willison, "Designing agentic loops" (30 Sep 2025)** — agents are a step
change because they can *exercise* the code they write. Look for problems with
clear success criteria. Also candid about YOLO mode: approval-per-command is
tedious and blunts the agent, but he has not seen sandboxing documentation he
trusts.

**Simon Willison, "Your job is to deliver code you have proven to work"
(18 Dec 2025)** — the closest statement of the verification-loop position:
get the system into a known state, exercise the change, assert it worked.
Test-harness integration as the key skill.

**Simon Willison, "Setting up a codebase for working with coding agents"
(25 Oct 2025)** — concrete harness advice: tests the agent can run itself, plus
interactive checking via a dev server, Playwright or curl.

**What it is selling, which you should name:** Willison writes from solo work on
his own projects, publicly, with a stake in these tools being good. That does
not make him wrong — he is the sharpest writer on this — but "my job is to
deliver code I have proven to work" is a claim about a practitioner with
decades of judgement about *what proof looks like*. The practices do not
transfer to someone who cannot yet tell a real check from a vacuous one.

## The counter-case you must meet

The strongest objection: **this is just testing discipline, which predates
agents by fifty years.** Meet it, don't dodge it. The answer is a question of
rate and asymmetry — agents generate tests as fast as code, a generated test
that cannot fail looks exactly like one that can, and the reviewer's own skill
at telling them apart is the thing Bainbridge says is eroding. The discipline
is old; what is new is that the cost of producing a plausible-looking check has
collapsed while the cost of auditing one has not.

## What to leave out

Your own project. One sentence of illustration at most — the note is marked on
the field, and the evidence from this repo belongs in PROCESS.md.

## Sources to verify before citing

All five were found via search, not read in full. Before the note is submitted,
check: the Parasuraman & Manzey page numbers, the METR author list and exact
date, and that each Willison URL still resolves. Do not cite a page number you
have not seen.
