# ADR 0001 — How the agent work is organised

**Status:** accepted 15 October 2026 (`99e4c6d`), still in force. Amended
9 November 2026 to record what the first month of using it cost.

## Context

Four-fifths of the mark is writing, and the stack was chosen to stop being
interesting: Node running TypeScript directly, one runtime dependency, no
build step. So the expensive thing in this project is not producing code. It
is keeping a growing set of invariants true while an agent edits files it did
not write.

Those invariants are unusually load-bearing here. "Nothing reaches the shelf
with one name on it" is the product; a change that is locally correct and
quietly breaks it is worse than a change that fails to compile, because the
app keeps working and the thing it exists for stops being true.

Two forces pull against each other. An agent is cheapest and most focused
when it reads a little. It is most correct when it has read everything. Any
workflow is a position between those, and the position has to be chosen
rather than drifted into.

## Decision

Three layers, each answering a different question.

**1. `CLAUDE.md` is the standing instruction**, read at the start of every
session. It holds what the argument forbids, not what the code does — the
code can be read, the reasoning cannot. A rule lands there the moment
something goes wrong, and for one category it lands *before*: a JavaScript
exception is written down and committed before the feature is built
([`41f1471`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/41f1471),
[`e935b00`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/e935b00)).
That ordering is what makes a script's *first* act hiding its own content, so
a script that fails to parse leaves the no-script page intact.

**2. One frozen contract per large change.** A single design pass settles
schema, invariants, routes and file ownership, and nothing afterwards is
allowed to re-architect. The post-crit-9 rebuild's contract is
`docs/orchestrator/gate1-contract.md`.

**3. Tiered delegation with exclusive file ownership**, specified in
`agent-orchestrator.md`: read-only scouting on the cheapest tier; UI and
tests on the middle tier, but only once the contract is frozen; schema,
identity, concurrency and security review on the strongest. One accountable
owner per path, at most two writing agents at once, and only on disjoint
files. Work moves through gates — audit, contract, persistence, realtime,
interface, QA and security, evidence — with a stop/go between each.

Two prohibitions stand above the routing. An agent proposes factual edits to
`README.md` and `PROCESS.md` and never writes the argument itself; the first
line of `docs/orchestrator/gate6-evidence.md` says so and the gate obeyed it.
And nothing deploys without the owner saying so.

## Options not taken

**One agent, whole repository, every session.** Cheapest to set up, and it is
what the project falls back to for small work. Rejected as the default for
large changes because its failure mode is exactly this project's: a change
that is right in the file it touches and wrong three files away.

**Competing designs, then pick one.** Rejected on cost. Two architectures is
two rewrites, and the frozen contract is the thing that makes everything
after it cheap.

**Ownership by layer rather than by path.** Rejected because this app has no
layers to own. `src/render.ts` is one file holding the markup, the whole
stylesheet and the client script, so a "frontend owner" and a "backend owner"
would collide inside it. Ownership is by path, and overlapping edits are
serialised rather than parallelised.

## Consequences

**The contract is allowed to shrink the plan, and did.** The audit found
`src/events.ts` already payload-agnostic and the client already refetching on
any event, so the realtime gate was folded into the persistence gate before
either was built: new write paths just call the existing `publish()` after
commit. A plan that could not shrink would have produced a transport layer
the app did not need.

**Corrections become durable instead of local.** The strongest evidence in
this repo is a fix landing in `CLAUDE.md` or `spec/` rather than only in the
code: the rule that a control the script has not reached must not look like a
control, the five-notes-a-day rules, and the rule that the HTTP spec needs a
database that has not already spent today.

**It keeps the agent out of the student's voice**, which is both an
assessment requirement and the reason the gate 6 report is a list of proposed
edits rather than a diff.

**It costs context before it saves any.** `agent-orchestrator.md` is about
four thousand words that must be read before work starts. That is worth it
for a rebuild and not worth it for a one-file change — which is why most of
the seventy-four commits on `main` since gate 6 are ordinary single-agent
work under `CLAUDE.md`, not gated runs. The gated workflow is a tool for a
particular size of change, not a process the project runs continuously, and
saying otherwise would overstate it.

**Gate artefacts date, and must be read as dated.**
`docs/orchestrator/gate1-contract.md` describes a schema that has since
grown: it has `title` and `event_date`, and knows nothing of the five-a-day
table or the note board. It is a record of what was decided on 15 October,
not current documentation. `CLAUDE.md` is the current documentation, and when
the two disagree `CLAUDE.md` wins.

**Tier routing depends on the platform offering tiers.**
`agent-orchestrator.md` requires that an unavailable capability be reported
rather than simulated: if real subagents or model selection are not
available, the same phased plan runs sequentially and the report says so.

## Not recorded here

How many agents ran at which tier, and what the run cost. Those numbers exist
only in session transcripts, and no tool in this project measures them, so
this record does not state them.
