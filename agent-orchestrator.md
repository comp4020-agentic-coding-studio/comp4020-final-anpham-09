# Multi-Agent Orchestration Prompt — The Village: Across the Distance

**Purpose:** Give an autonomous coding-agent coordinator an efficient, model-routed plan to implement the existing `prompt.md` with minimal duplicated work, bounded context/token use, clear code ownership, and verified outcomes.

**Target application:** The existing COMP4020 The Village final-project repository, deployed at `https://comp4020-final-anpham-09.fly.dev/`.

**Read this file AND `prompt.md` before starting.** `prompt.md` is the authoritative feature specification and acceptance contract. This document governs **how to delegate, sequence, verify, and control cost**. It does not replace, weaken, or silently reinterpret the project's requirements or repository/course instructions.

---

## 1. Your role: Orchestrator

You are the **Lead Engineer / Multi-Agent Orchestrator**. Your job is to coordinate specialized agents, not to have every agent read and implement everything independently.

Your objectives, in order:

1. Preserve the existing repository, routes, records, identity/session behaviour, and deployed data.
2. Deliver **P0** end-to-end: persistent `IN_ROOM` / `ON_SHELF` memory semantics, Memory Relay, live presence and shared state updates, Memory Shelf, and a usable Living Village UI.
3. Demonstrate **two genuinely independent browser profiles**, real-time updates within approximately one second under normal conditions, and persistence after restart.
4. Make `README.md`, `CLAUDE.md`, `spec/`, and factual process evidence consistent with the implementation without fabricating student reflections or research.
5. Minimize **total execution cost**, unnecessary tokens, redundant file reading, merge conflicts, and rework.
6. Do **not** begin P1/P2 unless P0 is working and verified.

**You must implement and verify, not merely write a plan.** Remain honest about anything your environment cannot execute or verify.

### Safety and scope

- Respect `CLAUDE.md`, protected course/riff instructions, `spec/README.md`, and any stricter repository rules. Never edit protected sections.
- Work only in the designated final-project repository. Do not touch earlier assignments or unrelated repositories.
- Do not deploy to production, push to a deployment-triggering branch, rotate secrets, migrate production data, or run destructive database operations without explicit approval.
- Preserve existing data and use non-destructive, reversible or additive schema changes. Use isolated temporary test databases where possible.
- Do not invent user research, test results, benchmark numbers, Git commits, references, crit reflections, or student-authored process narratives.
- If real subagents or model selection are unavailable, **do not pretend delegation occurred**. Execute the same phased plan sequentially with the available agent and report that constraint.

---

## 2. Cost-aware model routing

Map the **capability tiers**, not specific proprietary model names, to whatever models are actually selectable in this coding environment.

| Tier | When to use | Suitable responsibilities | Avoid assigning |
|---|---|---|---|
| **FAST / LOW-COST** | Straightforward, bounded, low-risk tasks | Repository inventory, locate files, summarize existing tests, prepare checklists, extract factual implementation evidence, straightforward docs suggestions | Database migration design, authentication/authorization, concurrency, architectural trade-offs |
| **BALANCED / MID-COST** | Moderate code generation and test authoring | HTML/CSS/UI components, accessibility, conventional endpoints from a frozen contract, deterministic tests, browser smoke tests, lint/typecheck fixes | Unspecified transactional invariants, difficult races/reconciliation, high-risk security decisions |
| **DEEP / HIGH-REASONING** | Brief high-impact decisions, correctness-critical implementation, targeted hard bugs | Architecture, legacy migrations, keeper identity/uniqueness, concurrent writes, SSE/reconnect/event ordering, security threat review, final integration debugging | Broad file cataloguing, cosmetic polish, repetitive document edits |

Possible examples **only if available in the agent platform**: low-cost/fast model family (e.g. a *Haiku*-class model), balanced family (e.g. *Sonnet*-class), high-reasoning family (e.g. *Opus*-class). Availability, exact model IDs, capabilities, and prices vary: **discover and use actual supported model identifiers** instead of guessing or hardcoding obsolete names.

**Optimize dollars and total effort, not just raw token count:** A cheaper model can consume more tokens or produce mistakes that cost more to fix. Escalate a failing task once rather than repeatedly retrying it on a model that cannot handle it.

### Concrete routing rules

1. Begin with one **FAST read-only Scout** for repository inventory and baseline commands.
2. Use one **DEEP Architecture/Correctness** pass to settle invariants, schema boundaries, transport protocol, and file ownership. Do not ask multiple agents to design competing architectures.
3. Assign transactional persistence and identity logic to **DEEP**.
4. Assign real-time transport and reconciliation to **DEEP** if they are genuinely nontrivial; otherwise the core backend owner may implement both to reduce integration cost.
5. Assign frontend UI, layout, accessibility, and small animations to **BALANCED** once API contracts are frozen.
6. Assign unit/integration/browser test implementation to **BALANCED** and reserve a short **DEEP** review for critical races, access control, and invariants.
7. Assign docs inventory, factual change log, and command-result summarization to **FAST**.
8. Use the **Orchestrator** for merge/integration decisions and go/no-go gates, not for duplicating the entire implementation.

### Suggested task budgets (soft guidelines)

- **FAST:** narrow inputs (relevant files or summaries only), concise output normally <= 400 words.
- **BALANCED:** one cohesive feature or test slice at a time; concise output normally <= 600 words.
- **DEEP:** one well-defined high-risk decision or coding slice at a time; concise output normally <= 800 words.
- Avoid feeding an entire repo, all tool logs, or all previous conversation turns to every agent.
- Limit each task to **one implementation pass + one focused fix pass** before reassessing or escalating.
- Do not request chain-of-thought, exhaustive internal reasoning, or narrated step-by-step deliberation; require brief decisions, evidence, artifacts, and unresolved risks.
- Keep at most **two code-writing agents active concurrently**, and only on disjoint file sets. Read-only audit/review work can run alongside coding.

---

## 3. Mandatory shared context and handoff protocol

The Orchestrator owns a concise **Project State Brief** (~500–900 words maximum) that is updated only when facts change materially. It contains:

- Verified stack/runtime, package manager, source/test directories, Fly/database configuration constraints.
- Existing entity/schema and routes; data preservation requirements.
- Actual baseline check results and known pre-existing failures.
- Product invariants from `prompt.md`, especially keeper identity and atomic `IN_ROOM -> ON_SHELF` transition.
- Agreed endpoint/event payload contracts, ownership map, and module interfaces.
- Current P0 task statuses, integration blockers, and accepted design decisions.

**Do not let every agent rediscover the entire application.** Pass each agent:

1. The role and exact task.
2. Only the relevant sections of `prompt.md` and Project State Brief.
3. Exact file/module ownership and files they may read or edit.
4. Required outputs and acceptance tests.
5. A short completion-report template.

Every delegated agent must return:

```
TASK_ID:
STATUS: DONE | PARTIAL | BLOCKED
FILES_CHANGED: [paths, or none]
WHAT_CHANGED: [<= 5 specific bullets]
TESTS_RUN: [exact commands + actual result; none if not run]
API_OR_SCHEMA_IMPACT: [short]
RISKS_OR_BLOCKERS: [short]
NEEDS_ORCHESTRATOR_DECISION: [yes/no + question]
```

Responses should **summarize diffs**, never dump whole source files or large raw logs unless a focused excerpt is needed for debugging. For errors, pass the decisive stack trace or failed assertion and how to reproduce, not the complete terminal transcript.

Use the task tool/agent tool supported by your environment; do not invent model-switching or delegation APIs. If the environment cannot control model tier per subagent, use task decomposition anyway and report actual routing limitations.

---

## 4. Ownership and parallelism rules

**Exclusive write ownership is mandatory.** Decide the concrete paths after auditing the repo; the table below gives functional boundaries, not invented repository paths.

| Workstream | Default owner | Primary scope | Coordination rule |
|---|---|---|---|
| Repository audit | Scout / FAST | Read-only audit and baseline evidence | No code edits |
| Architecture and contracts | Architect / DEEP | Data invariants, endpoint/event contract, migration plan | One authoritative design, reviewed by Orchestrator |
| Persistence, identity, keeper transitions | Backend / DEEP | DB migrations, authoritative domain writes, session checks | Exclusive ownership of relevant DB/domain files |
| Transport, presence, client reconciliation | Realtime / DEEP or same Backend owner | SSE/WebSockets, connection lifecycle, event replay/resync | Start from frozen backend contract; do not edit DB schema independently |
| User interface | Frontend / BALANCED | Views/templates/styles/client UI interactions | Consume agreed APIs; no unapproved schema or server-contract edits |
| Tests and evidence | QA / BALANCED | New test files, targeted browser checks, failure reports | Avoid editing product source; route bug fixes to file owner |
| Docs and checks inventory | Documentation / FAST | Factual proposed edits/checklists/reports | Do not fabricate student argument/reflections; protected `CLAUDE.md` not edited |
| Focused security review | Reviewer / DEEP | Read-only threat/consistency review | Return targeted defects with reproduction details |

Use separate Git worktrees/branches if available and safe. Otherwise **serialize any overlapping edits**. Never allow two agents to modify the same file simultaneously. Agree ownership of shared `package.json`, migrations, route indexes, CSS entry points and cross-cutting config **before** writing. The Orchestrator integrates shared-file changes deliberately.

**Reduce conflicting parallelism:** Database semantics, endpoint contracts, and broadcast payloads should stabilize before major UI/test implementation. Parallelize independent UI and test tasks after that point.

---

## 5. Task dispatch plan with stop/go gates

### GATE 0 — Scout the existing application [FAST / read-only]

**Task ID:** `A0-AUDIT`.

Inspect `README.md`, `CLAUDE.md`, `PROCESS.md`, `spec/`, `package.json`, source layout, cookie/session flow, existing memory/shelf behaviour, `fly.toml`, Dockerfile, and the persistence mount. Record baseline results of `pnpm check` and `pnpm check:evidence` if defined.

**Deliver:** A compact verified inventory: paths, actual stack, tested flows, baseline failures, schema/route map, runtime constraints and risks. No feature coding.

**Gate:** Orchestrator verifies source paths and current behaviour are understood. Unknown facts stay labelled **unknown**.

### GATE 1 — Freeze the product and interface contract [DEEP / short design task]

**Task ID:** `A1-ARCH`.

Use the confirmed audit facts and `prompt.md` to specify:

- `IN_ROOM` and `ON_SHELF` invariants, membership/keeper logic, append-only contributions, transaction boundaries and idempotency.
- Reuse or additive migration of existing schema; preservation of all existing records.
- Member versus browser/session identity, with honest limits on detecting actual humans.
- HTTP write routes, response status/payloads, shared state snapshot, and event types including IDs/revisions.
- Real-time transport choice: SSE by default if suitable; reconnection, race-free snapshot convergence, presence semantics and cleanup.
- Error states, no-JS/core fallback, permissions and data visibility in a public classroom demo.
- Concrete file ownership and minimal change plan.

**Deliver:** A concise approved interface contract and dependency list. Resolve ambiguity **once**. Do not build a competing rewrite.

**Gate:** P0 invariants have testable definitions, and implementation owners know which interface to target.

### GATE 2 — Implement persistent core [DEEP]

**Task ID:** `A2-CORE`.

Build or adapt the existing storage and server-side domain workflow:

- Create memory -> persisted `IN_ROOM` with creator, house, story and event date.
- Append attributed perspectives without mutating original author content.
- Different member explicitly chooses **Keep this together** after contributing -> atomic, idempotent `ON_SHELF` transition, unique keeper records and `kept_at`.
- Validate input and session/house claims server-side; reject spoofed status/keeper IDs.
- Read canonical memory/house/shelf snapshots, preserving old records.
- Keep writes deterministic for retries and concurrent submissions; broadcast only after committed writes via an agreed interface.

**Deliver:** Functional server/domain code, additive migrations, critical domain tests and exact results.

**Gate:** Two identities cannot bypass the keeper rule; concurrency and restart preservation are verified at the API/data layer before UI polish.

### GATE 3 — Implement real-time synchronisation [DEEP, or Backend owner if simpler]

**Task ID:** `A3-REALTIME`.

- Wire accepted memory/contribution/keep changes to server-originated events; target ~1-second propagation.
- Implement truthful ephemeral room presence, heartbeats/cleanup, multiple-tab semantics and correct cross-room scoping.
- Connect clients to authoritative snapshots and live events; reconcile on reconnect without duplicates or missed writes.
- Do not count disconnected users as permanently online; do not persist presence as a family memory.
- Preserve ordinary HTTP form/read behaviour during temporary transport failures.

**Deliver:** Transport/client-sync changes, relevant tests, measured latency if tools permit, and any observed gaps.

**Gate:** Two independent sessions converge; disconnect/reconnect and failed-write broadcasting are tested.

### GATE 4 — Build the user experience [BALANCED; can overlap independent QA]

**Task ID:** `A4-UI`.

Implement the approved visual flow on the existing pages:

- **Living Village Map:** Four recognizable locations; accessible house navigation, authoritative live activity/presence.
- **Memory Relay:** Create memory, read original story, append distinct perspectives, explicitly keep together; accurate `IN_ROOM` and `ON_SHELF` language.
- **Memory Shelf:** Only shelved memories displayed as kept stories; pending memories remain findable in their houses; dates and keepers readable.
- **Accessible responsive experience:** desktop/mobile, focus, error states, clean typographic hierarchy and reduced motion.
- Gentle animations only after confirmed server state, not simulated actions or fake online visitors.

Do not add user accounts, direct messages, scores, streaks, AI-generated stories, 3D engines, or heavy media upload dependencies. Do not modify API semantics behind the Backend owner's back.

**Deliver:** UI assets/templates/styles and basic frontend verification.

**Gate:** The actual supported P0 journey is usable, comprehensible, and does not require extra hidden setup.

### GATE 5 — Validate reality, not mocks [BALANCED + targeted DEEP review]

**Task IDs:** `A5-QA`, `A5-SECURITY`.

QA must add/run tests that demonstrate:

1. Valid and invalid create-memory paths.
2. Only distinct identities with an actual perspective and explicit keep can promote memory.
3. Duplicate/replayed/concurrent submissions never double-count or corrupt state.
4. Browser A changes are visible in Browser B without reload, approximately within one second when measured.
5. Presence joins/leaves; no phantom members; same member with multiple tabs handled consistently.
6. Reload/restart persistence of `IN_ROOM`, `ON_SHELF`, authors, keepers and timestamps.
7. Reconnect consistency, UI error states, XSS/input validation, and no fake optimistic success.
8. `/`, `/readme/`, existing invariants, `pnpm check`, and `pnpm check:evidence` (as applicable).
9. A basic mobile and keyboard accessibility pass.

Reviewer conducts one **focused** security/correctness audit: forged identity/status, transaction boundaries, event race, data access, public family privacy. Return actionable findings only; Backend/UI owners fix their own files.

**Gate:** No open correctness-critical P0 failures. Existing course tests remain intact. If tools prevent true browser verification, mark it **unverified**, not passed.

### GATE 6 — Evidence, documentation, handoff [FAST + Orchestrator]

**Task ID:** `A6-EVIDENCE`.

Create a concise factual change log with actual file changes, migrations, check results, real-world limitations and manual verification steps. Ensure `/readme/` still serves the full student-authored README in server-returned HTML. Propose factual changes to README and allowed `CLAUDE.md` rules, tests and the student's `PROCESS.md` without inventing original arguments, interviews or reflections.

**Gate:** P0 completion can be demonstrated in two separate Chrome profiles; remaining limitations are clearly stated; owner can review before approving deployment.

### OPTIONAL GATE 7 — Additional features [only if all prior gates pass]

**Priority order:** `Story Night` -> `Family Chapters / search` -> `Threads Across Cities` or visual decoration.

Each option must get its own acceptance tests, small task scope and cost estimate. Stop immediately if it threatens P0 stability or assessment evidence. Optional work is **not** a reason to delay P0 verification.

---

## 6. Delegation prompt templates (send only the matching task)

### Standard task envelope

```text
ROLE: <Agent role>
MODEL_TIER: <FAST | BALANCED | DEEP, if selectable>
TASK_ID: <ID>
GOAL: <one concrete objective>
CONTEXT: <brief relevant facts from the shared Project State Brief>
SOURCE_OF_TRUTH: prompt.md sections <specific relevant sections>
OWNED_FILES: <exact files/directories after audit>
READ_ONLY_DEPENDENCIES: <paths>
DO_NOT_EDIT: <exact shared/protected paths>
REQUIRED_WORK: <small explicit checklist>
ACCEPTANCE_CHECKS: <commands/scenarios>
OUTPUT: <TASK_ID, STATUS, FILES_CHANGED, WHAT_CHANGED, TESTS_RUN,
         API_OR_SCHEMA_IMPACT, RISKS_OR_BLOCKERS, NEEDS_ORCHESTRATOR_DECISION>
LIMITS: Do not read unrelated files. Do not re-architect adjacent features.
        Do not deploy. Report real test results only.
```

### Ready-to-send A0 Scout prompt [FAST]

```text
Inspect the existing The Village final-project repository READ ONLY.
Read project/course instructions first. Identify actual stack, relevant code
paths, current routes, database/session model, tests, deployment persistence,
and existing functionality. Run baseline checks if safe. Return a compact
verified audit in the required task report format, including unknowns.
Do not propose a rewrite or edit code.
```

### Ready-to-send A1 Architect prompt [DEEP]

```text
Using the verified Scout report and prompt.md, define the smallest safe
architecture for Memory Relay (IN_ROOM -> ON_SHELF), distinct members,
append-only perspectives, atomic/idempotent keep operations, canonical
snapshots, real-time update transport and live presence. Reuse existing data
and routes. Freeze concise endpoint/event/schema contracts and assign exact
file ownership. Highlight only material risks and tests. No broad redesign.
```

### Ready-to-send A2 Backend prompt [DEEP]

```text
Implement the approved persistence/identity contract in your assigned files.
Preserve all legacy rows. Enforce server-side validation, append-only
perspectives, unique keepers, atomic and idempotent ON_SHELF transitions,
accurate dates and stable read APIs. Add focused domain tests. Do not edit
front-end files, deploy, or claim test results not obtained. Report changed
files, migration assumptions, exact test commands and unresolved cases.
```

### Ready-to-send A3 Realtime prompt [DEEP]

```text
Implement the approved real-time transport on the frozen backend contract.
Broadcast after committed writes, reconcile snapshots and event IDs across
reconnects, update room presence truthfully, clean up stale connections,
and respect multiple-tab semantics. Test with independent sessions and
measure update latency if possible. Own only assigned sync/transport files.
Do not change keeper rules or database schema without approval.
```

### Ready-to-send A4 Frontend prompt [BALANCED]

```text
Build an elegant, warm, accessible interface in the existing The Village
pages using the frozen server APIs. Focus on four-house Living Village Map,
Memory Relay composer/detail, clearly differentiated In the Room and On the
Shelf states, keepers and timestamps, and usable Memory Shelf. Respect
mobile, keyboard and reduced motion. Do not simulate successful writes or
fake presence. Do not modify shared backend/schema contracts.
```

### Ready-to-send A5 QA prompt [BALANCED]

```text
Create focused tests in your assigned test files for the approved project
invariants, including forged identity/status, duplicate and concurrent
keepers, async and real-time Memory Relay, reconnect, persistence, presence,
legacy routes and accessibility basics. Run available real checks and two
independent browser sessions when possible. Return exact failures and
reproduction steps. Do not loosen existing tests or edit product code.
```

### Ready-to-send A6 Documentation prompt [FAST]

```text
Produce a factual, concise implementation evidence summary from actual
commits, source diffs and test outputs. Identify precise suggested updates
to README/CLAUDE/spec and the facts the student should discuss in PROCESS.
Do not invent reflections, user studies, citations, crit outcomes or pass
results. Do not edit protected course instructions or student-authored
narrative. Flag missing evidence explicitly.
```

---

## 7. Escalation and token-saving policy

- **No duplicate assignments.** A task has one accountable owner and a single definition of done.
- **Don't repeatedly scan the entire repo.** Cache the verified inventory in the Project State Brief; reopen only files relevant to a changed fact.
- **No speculative framework migration.** Prefer small changes in the proven stack.
- **No speculative features.** P0 correctness outranks Story Night, AI, rich uploads, sophisticated animation or decorative maps.
- **No redundant agent debates.** One Architect decides the proposed contract; one focused reviewer can flag serious flaws.
- **No giant prompts per agent.** Provide specific sections and file boundaries instead of full transcripts or every previous subagent output.
- **No unbounded retries.** For a failed task: identify the precise failure, retry once with the relevant facts, then escalate to a stronger tier or re-scope. Don't re-run expensive agents for formatting-only edits.
- **Use deterministic tools first.** Existing tests, typecheck, linters, grep/search and short repro cases often resolve issues more cheaply than another model call.
- **Small commits and clean handoffs.** Merge after the owner has run the relevant checks; never allow simultaneous conflicting changes.
- **Reserve DEEP review for high-risk defects.** Routine formatting, CSS and report condensation do not need the strongest model.
- **Stop on a genuine safety blocker.** Do not trade database integrity or privacy for finishing on schedule.

### When parallel work is worth it

Parallel tasks are allowed only when their dependencies and file ownership are separate. Good examples: independent frontend layout and QA test scaffolding after a frozen contract; read-only security review while backend is being tested. Bad examples: concurrent edits to the same routes, database migration, event payloads, or package manifest.

### Progress reporting

At each gate, communicate **only**:

- Completed deliverable and actual evidence.
- Remaining blocking task and assigned model tier.
- Any decision requiring owner approval.

Avoid verbose play-by-play or copied tool output.

---

## 8. Completion gates and final response

P0 is **DONE** only when the original application's data and required routes are preserved; two independent sessions create and enrich a real memory; the second distinct member can explicitly keep it; both clients update automatically; authoritative data survives restart; presence is accurate; the shelf is discoverable and accessible; and real repo checks are reported truthfully.

Keep the product's definition of **good** visible in both UX and testable rules:

> An individual moment can be recorded alone, but it becomes a shared family memory through a distinct person's meaningful contribution; it stays discoverable with its provenance even after everyone leaves.

### Final coordinator report (short, evidence-based)

1. **Actual delegation:** role -> actual model/tier -> owned scope; say if model selection/subagents were unavailable.
2. **Implemented:** P0/P1/P2 as DONE, PARTIAL, BLOCKED or NOT STARTED; key changed paths.
3. **Database/identity:** schema changes, preserved data, transaction and auth safeguards.
4. **Real-time:** selected mechanism, observed two-browser behaviour, reconnection and latency evidence (only if measured).
5. **Verification:** exact checks and results (`pnpm check`, `pnpm check:evidence`, other tests; live browser tests and restart checks).
6. **Good/assessment alignment:** which product principles are enforced in code/tests, and which still require honest human evaluation/student documentation.
7. **Cost-efficiency report:** agent calls by tier if available, repeated work avoided, approximate token/cost totals **only if exposed by actual tools**; otherwise state not measurable.
8. **Remaining blockers / owner approvals:** never conceal failure or claim deployment was performed without approval.

**Do not push to a deployment-triggering branch or deploy production until explicitly authorised.**

---

## 9. The command to begin

After `agent-orchestrator.md` and the existing `prompt.md` are placed in the repository root, send your coding agent this message:

```text
Act as the multi-agent orchestrator for this existing The Village repository.
Read agent-orchestrator.md and prompt.md, then read and obey CLAUDE.md and
course instructions. Delegate only when real subagent/model-routing tools
exist; otherwise follow the exact phased tasks sequentially. Optimize total
cost using FAST/BALANCED/DEEP capability tiers, strict file ownership and
short handoffs. Start with the read-only repository audit and baseline checks.
Implement and verify P0 completely before any optional features. Preserve
all existing data and student-authored coursework evidence. Do not deploy
or push to a deployment-triggering branch without my explicit approval.
Report actual tests, changed files, limitations and delegation accurately.
```
