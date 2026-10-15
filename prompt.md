# Autonomous Implementation Brief — The Village: Across the Distance

**Project:** COMP4020 Final Project (full-stack capstone)  
**Existing deployed application:** https://comp4020-final-anpham-09.fly.dev/  
**Document purpose:** Implementation instructions for an autonomous coding agent working **inside the existing final-project repository**.  
**Priority:** A functioning, defensible, tested multi-user experience; visual polish must reinforce it, never replace it.

---

## 0. Your role and authority

You are the senior product-minded full-stack engineer, interface designer, and test engineer improving an **existing** application called **The Village**. Do not start a new unrelated project, replace the repository, or quietly discard working code.

Carry out the implementation rather than merely suggesting a plan or generating mockups. Inspect the codebase first; then design, change code, create automated tests, run the app locally, test realistic browser flows where tools allow, and produce an honest implementation report. Make reasonable choices autonomously within the boundaries below. If a critical requirement cannot be satisfied safely, preserve a working application and document the blocker instead of simulating success.

**Safety boundaries:**
- Work in the designated final-project repository only. Never modify a different riff, prior assignment, or graded original repository.
- Read and respect `CLAUDE.md`, including any protected sections, before editing. Obey repository-specific instructions and course-provided invariants.
- Do not deploy to production, push a deployment-triggering branch, change Fly.io infrastructure/secrets, or perform destructive database operations without explicit owner approval. A local build, local run, non-destructive tests, and work on an appropriate development branch are authorised.
- Do not silently replace real content with seed data, change existing identities, delete memory records, or rewrite history.
- Do not fabricate user interviews, evaluation outcomes, screenshots, benchmark numbers, research citations, crit feedback, Git history, or personal reflections.
- Do not claim a feature is working merely because code was written. Verify it.

## 1. Read the actual repository and assessment contract first

Before making any code changes:

1. Read `README.md`, `CLAUDE.md`, `PROCESS.md`, `spec/README.md`, all relevant tests, `package.json`, and any project-specific notes or instructions.
2. Inspect the application source, templates, CSS, JavaScript, routes, session/cookie implementation, database schema, storage directory, migrations, and upload handling if any.
3. Inspect `fly.toml`, Dockerfile, persistent volume configuration, CI/workflows, and resource limits. **Do not assume** a particular stack, memory size, database path, or transport until verified.
4. Run the existing repository checks to establish a baseline, including `pnpm check` and `pnpm check:evidence` if available. Record results, existing failures, and commands used.
5. Trace the current flows for entering the village, selecting a house, Village Map, Memory Shelf, Meeting House, and leaving. Read the current `/readme/` implementation and verify its server-rendered behaviour.
6. Inventory real persisted entities. Decide which existing tables/routes/UI components can be **extended**. Design additive migrations and backward-compatible changes.
7. Write a concise implementation plan and a mapping from each proposed change to the product's definition of good. Then implement.

The existing public homepage presents **Village Map, Memory Shelf, Meeting House, Leave the Village**, with a name and a chosen house and an anonymous browser cookie. Treat this as observed entry-page behaviour, **not proof of uninspected internal implementation**.

### Fixed COMP4020 requirements

The finished app must be:
- **Multi-user:** Two independent people in separate browsers/profiles have distinct identities and act on shared state.
- **Real-time:** When one acts, other open sessions showing the same shared state update within approximately one second, without reload or viewer action.
- **Persistent:** Accepted meaningful actions survive navigation, independent sessions, application restarts, and redeploys, using persistent storage.

It must also show a clear, defensible definition of **good**, backed by the running application, README argument, `CLAUDE.md` rules, and automated checks in `spec/`. Keep `GET /` and `GET /readme/` working, with the complete README headings in the **server-returned HTML**. The course checks `pnpm check` and `pnpm check:evidence` must pass. Do not weaken course tests to manufacture a pass.

Assessment context: markers arrive from the deployed URL, read `/readme/` first, and test two separate Chrome profiles simultaneously. They may return after the Fly machine restarts. The strongest app also handles simultaneous actions and slow connections gracefully. This is an **individual assessment**; respect genuine student authorship of reflections and process arguments.

## 2. Product mission — retain the original insight

### Name and positioning

**The Village — Across the Distance**  
**Tagline:** *Different places. Shared stories.*

A small family spans several cities. Existing chats already make it easy to send information; the difficulty is returning to the few moments that mattered and remembering **what happened, who added to the story, and who chose to keep it**.

Build a private-feeling, warm and accessible family storytelling space. Preserve the recognizable four-place metaphor: **Nghệ An House, Hanoi House, Canberra House, and Meeting House** (reuse actual house IDs/names already present; do not break links or data). This is not a chat-room reskin, photo-feed clone, gamified social network, or full game.

### Proposed definition of good (product design contract)

> **Good means turning individual moments into meaningful, discoverable family memories through shared contribution, without requiring everyone to be online at the same time.**

A good experience must satisfy these principles:

1. **Meaningful keeping:** An individual memory and a jointly kept memory are different, clearly labelled states.
2. **Shared storytelling:** Another family member can add a distinct perspective rather than replacing the original author's record.
3. **Together, not dependent:** A person can create a memory asynchronously; co-presence makes the experience richer but is **not** a prerequisite to using the application.
4. **Built to rediscover:** Years later, a person should be able to find a memory by house, people, date, and words, with attribution intact.
5. **Quiet by design:** No infinite engagement feed, popularity counters, scores, streaks, direct messages, or push notifications.

Everything built must have a credible connection to one or more principles. Prefer fewer complete, excellent features over many superficial ones.

### Important evolution of the original rule

The original concept only shelved a moment when two people were concurrently present. **Change this deliberately** for families in different time zones. A memory may be created by one person and kept together later, even if the author is offline. Preserve the original distinction between individual and shared memory, but do not require a simultaneous session for promotion.

Do not claim that a person who was online is an eyewitness to the original real-world event. Label shared provenance as **"Kept together by ..."**, not "Witnessed in person by ...", unless explicitly evidenced.

## 3. Non-negotiable memory semantics

Define and implement exactly two enduring semantic statuses:

- **`IN_ROOM`:** The memory is already persisted, visible within its authorised room, and attributable to its creator; it is not yet a jointly kept memory.
- **`ON_SHELF`:** The memory remains persisted and has been explicitly kept by **at least two distinct members**, including the creator, with attribution and a server-recorded keep date.

**Proposed clear MVP rule:** Creating a memory constitutes the creator's explicit choice to keep a record. To transition to `ON_SHELF`, a *different verified application member identity* must add a genuine written perspective and explicitly select **"Keep this together"**. Merely visiting, opening a card, clicking like, or being online is not confirmation. The second member can act later, without the creator being present.

Implementation invariants:
- New memory starts `IN_ROOM` only **after** successful server validation and persistent database write.
- Creator attribution, original story, event date (if supplied), creation timestamp, and house association never silently disappear.
- Contributions are append-only; one person's contribution never overwrites another's.
- Keep acknowledgements are server-validated and idempotent. Use a unique constraint for `(memory_id, member_id)` or equivalent.
- Transition to `ON_SHELF` is atomic and monotonic under ordinary operations. Store `kept_at` separately from the date the event occurred.
- The same member cannot satisfy the two-member condition twice through two tabs or a repeat request.
- Distinct browser sessions / pseudonymous member IDs support the marking scenario, but **cookie identity alone cannot establish real-world human identity**. Document this limitation honestly. Never equate distinct display names with cryptographic identity.
- Requests arriving nearly simultaneously must not create duplicate contributions, duplicate keepers, repeated promotions, or inconsistent client views.
- Both statuses and their history survive restarts/redeploys. `IN_ROOM` memories are not discarded as "unconfirmed".
- If an existing feature differs, preserve old stored data and apply a safe, documented migration or compatibility mapping.

For real family photos and sensitive content, do not make material publicly available on an unauthenticated Fly.io demo. Prefer fictional/sample **clearly labelled demo** content and a separate documented family-only access strategy. A common invite code is an access gate, not a trustworthy proof of which family member is acting. If secure member verification is beyond MVP scope, disclose that explicitly and **do not** claim private-family security.

## 4. Feature P0-A — Living Village Map

**Goal:** Make the existing Village Map the discoverable, interactive hub of family activity, not merely a list of links.

### Required experience

- Preserve four places and existing navigational routes or supply backward-compatible redirects.
- Show a coherent illustrated or architecturally inspired map with clickable/focusable house elements, clear text names, visible affordances, and lightweight motion.
- Each house conveys: its name, what it is for, an up-to-date presence indicator, and real counts of `IN_ROOM` and/or `ON_SHELF` memories as appropriate.
- Entering a house opens a usable room view showing its current memories, other present visitors, and an obvious way to create a memory.
- Live membership and relevant new memory/shelf events update the map without reload.
- Use actual stored counts and events; never fabricate activity, presence or family messages just to make the world appear busy.
- Provide graceful empty states for zero visitors/zero memories, and a text-based navigation fallback if canvas/illustrations cannot be used.

### Layout direction

Use an **editorial family-memory aesthetic**, not a farming game or administrative dashboard:
- Warm paper/cream background, soft terracotta accents, sage green, walnut/brown text, subtle muted blue.
- Thoughtful typography, generous whitespace, restrained shadows, tactile postcard/album treatment.
- Distinct visual cues for each house, but one consistent design system.
- On desktop, make the village visual the primary feature with a readable activity/memory panel; on mobile, stack controls naturally and use adequately sized touch targets.
- Motion should clarify changes (house lights, gentle postcard emergence), not demand attention. Support `prefers-reduced-motion`.
- Do not copy copyrighted artwork, use unlicensed stock images, or create misleading personal photographs.

### Acceptance example

In Profile A, enter Hanoi House. Profile B, viewing the map, sees the house presence change without refresh. When A creates a memory, the relevant house activity/count updates on B within roughly one second.

## 5. Feature P0-B — Memory Relay (signature feature)

**Goal:** Turn a solitary uploaded moment into a multi-perspective story with durable provenance.

### Create a memory

From a house, enable a member to create a memory with:
- **Title** (required, length-limited).
- **Original story** (required, length-limited, safely rendered).
- **Event date** (optional; separate from `created_at`).
- House/location association from the active room, verified server-side.
- Optional photo **only if safe, durable upload infrastructure already exists or can be implemented within available resources without jeopardising core requirements**. Text-first MVP is preferable to unreliable media support.

Show an informative validation error and preserve the submitted draft if a request fails. Never display success before the server confirms the write.

Upon success, persist the memory as `IN_ROOM`, attach creator identity and timestamp, render a memory card, and broadcast a server-confirmed update.

### Read and contribute

- A memory detail panel/page shows its original story and a chronological **"Perspectives"** section.
- Another member can choose **"Add your perspective"** and submit their own text. The additional perspective has its own author and created timestamp; it does not overwrite the original.
- The same person may append further perspectives, but one member still counts as **one** keeper.
- Every accepted contribution broadcasts to viewers of that house/memory in real time.
- Avoid character-by-character multi-user text editing; server-committed append-only contributions are enough, safer, and more legible.

### Keep together

- After submitting a perspective, a distinct second member may explicitly click **"Keep this together"** (or a clear combined action with explicit acknowledgement).
- The server authorises the action and atomically updates the keeper records and memory status.
- Show the exact result: `IN_ROOM → ON_SHELF`, **"Kept together by [creator] & [second member]"**, and the server-confirmed keep timestamp.
- Both viewers witness a gentle postcard-to-shelf transition if motion is allowed. The animation represents the persisted transition; it is not the source of truth.
- The card becomes discoverable on Memory Shelf. Do not clone the memory into a second inconsistent record.

### Concurrent and reconnect cases

- Two different members may act simultaneously. Use transactions, uniqueness constraints, stable event IDs, and idempotency where appropriate.
- A repeat POST or reconnect must not record another keeper or visually duplicate a memory.
- Opening the page later reconstructs the same state from persistence. It must **not** replay old transition animations.
- If server rejects a keep action, restore UI to the actual authoritative state and display a useful error.

## 6. Feature P0-C — Memory Shelf & Rediscovery

**Goal:** Turn the original Memory Shelf into a long-term, searchable, human-readable collection rather than an endless newest-first feed.

### Required MVP

- Only show `ON_SHELF` memories on the shared Shelf; keep `IN_ROOM` memories available in their originating house or a clearly labelled pending section.
- Present cards as readable postcards/album entries with **title, house, event date (if any), kept date, and named keepers**.
- The detail view exposes the complete original story and append-only perspectives with author attribution.
- Add lightweight filters: house and/or time period. Provide a simple keyword search over indexed titles/stories/perspectives if achievable without compromising P0 reliability; otherwise document it as P1.
- Keep results deterministically ordered with stable pagination or bounded lists; do not build an addictive infinite scroll.
- Preserve accessible text views independently of animations or images.
- Database is authoritative. Reloads, new browser profiles, restarts and redeploys must show exactly the accepted memories and history.

### Required provenance

Distinguish clearly between:
- `event_date`: when the remembered event happened (may be an approximate or user-selected date).
- `created_at`: when the memory was initially recorded.
- `kept_at`: when it became jointly kept.
- Contributor/keeper membership: who wrote which perspective and who chose to keep it.

Do not create fictional timestamp precision or alter historical dates merely to simplify a UI.

## 7. Feature P0-D — Live Family Presence

**Goal:** Make concurrent use visibly meaningful without requiring members to be online together for core memory keeping.

- Retain existing cookie/pseudonym identity if appropriate; inspect its implementation. Server assigns stable opaque IDs, validates sessions and associates presence with the correct active house.
- Show which distinct sessions or declared members are *currently viewing a house*. Keep the wording accurate; separate number of sessions from number of unique members.
- Presence joins/leaves propagate to other viewers without reload. Use heartbeat/expiration and connection cleanup to prevent ghosts.
- Duplicate tabs of the same identity must not inflate the number of distinct human/member identities. Document whether simultaneous tabs count as one member or multiple connections.
- A useful subtle enhancement: when two people view the same memory, display a quiet indicator such as **"Someone is reading this with you"**. Typing activity, if implemented, is optional and should not expose draft text.
- The currently online list is **ephemeral**, not a permanent activity score or history. No tracking or retention of more presence information than necessary.
- Show a neutral disconnected/reconnecting state if real-time transport goes down; allow ordinary page use to continue.

**Important:** Do not rely solely on CSS green dots that are not backed by live server state.

## 8. Feature P1 — Family Story Night in Meeting House

Implement **only after all P0 features and their tests work**. This is a genuine collaborative space, not a new chat feed.

### User experience

1. A member starts a Story Night session in the existing Meeting House with a question or short theme, such as "What is a childhood moment you want us to remember?".
2. Other members join the same session, indicated by real presence.
3. Each adds one or more authored, time-stamped story contributions. The next accepted contribution appears on all other connected screens within approximately one second.
4. The story remains safely persisted while incomplete, so people can return and continue asynchronously if a connection drops or schedules differ.
5. After at least two distinct contributors participate, offer a meaningful, server-validated **"Complete our story"** action. Define and document the required confirmation semantics; avoid accidental finalisation.
6. A completed story becomes or links to one `ON_SHELF` memory, with explicit provenance and **without duplicating entries or losing individual contributions**.
7. Concurrency and reconnect behaviour must be safe and deterministic.

Prefer append-only contribution cards, not character-level collaborative editing, video calls or a complex chat transport. Reuse Memory Relay's identity, events and contribution models where it makes architectural sense.

If time-constrained, preserve the existing Meeting House functionality and leave Story Night unimplemented but precisely listed in the final report. **Do not claim P1 is finished if it is not.**

## 9. Feature P1 — Family Chapters & Findability

After core functionality works:
- Let members organise `ON_SHELF` memories into named thematic chapters such as **First Year**, **Childhood in Nghệ An**, **Across Cities**, or **Family Celebrations**.
- A memory may appear in several chapters without physical duplication.
- Provide lightweight search across memory title, story and perspectives; optionally filter by house, date and contributor.
- Reuse existing SQLite or database indexing. Do not add AI recommendations, vector search, hosted search infrastructure, or paid services.
- Validate empty, missing and conflicting chapter assignments. Preserve persistence and access control.

## 10. P2 enhancements — explicitly optional

Only consider these after P0 is reliable, tested and documented:
- **Threads Across Cities:** Visualise real cross-city memory contributions as delicate, interactive connections between houses. Derive links from genuine persistent data only.
- **Letters to the Future:** A structured collection of future-oriented family messages with well-defined access controls. Do not promise time-locked release without an implemented trustworthy mechanism.
- **Atmospheric time-of-day treatment:** Ambient light, window glow, subtle seasonal color. Keep it decorative, inexpensive and removable under reduced motion.

Avoid gameplay currencies, avatars wandering through a simulation, like counts, public leaderboards, mass notifications, a second messaging app, auto-generated family memories or fake active visitors.

## 11. Identity, access, safety and privacy

The existing public entry point uses a name/house selection and cookie. Preserve ease of entry for the marking experience; do not add a login flow that prevents a marker from trying the app from its URL.

- Verify identities **on the server** with session/member IDs; do not trust client-provided author IDs, status, role or keeper arrays.
- Reject spoofed writes, tampered house IDs, overlong text, unsafe media formats, malformed dates, cross-house writes and unauthorized state transitions.
- Escape/encode user text when rendering, enforce safe content limits, and protect mutation endpoints against CSRF or use appropriate same-site/session safeguards for the chosen architecture.
- Rate-limit sensitive writes and bound real-time connections reasonably for a small Fly machine.
- Do not log raw memories, child images, session tokens, personal family data, or secrets.
- If the app is used publicly for course marking, use fictional demonstration content and clear "Demo" labels. Do not expose real family stories/photos. A future family-only mode may require invite-based or stronger access controls; document trade-offs rather than inventing security claims.
- The original "no edit/no delete" aesthetic can remain for normal UX, but implement or document a deliberate **privacy/safety exception** for unlawful, mistaken or harmful content. Do not automatically destroy existing user data or introduce broad deletion controls without discussion.
- Maintain an understandable privacy statement for testers: what identity is stored, how sessions work, what is public/private, and what persists.

## 12. Architecture and synchronisation

Prefer **incremental improvement** over a framework migration. Preserve the existing backend/framework/SQLite or other verified persistent store where feasible. Do not adopt a new SPA, 3D engine, remote database or paid service merely because it is fashionable.

### Suggested model (adapt to the real schema)

Possible entities (names illustrative, not mandatory):
- `members`: opaque ID, display name, optional house; session association.
- `houses`: stable house ID and location/name.
- `memories`: ID, house ID, creator member ID, title, story, event date, created timestamp, status, kept timestamp.
- `contributions`: ID, memory ID (or typed parent), author member ID, body, creation timestamp, optional idempotency key.
- `memory_keepers`: memory ID, member ID, confirmed timestamp; unique `(memory_id, member_id)`.
- Optional `story_sessions`, `chapters`, `chapter_memories` as P1 requires.

Model story contributions explicitly; do not create ambiguous foreign keys or overload a data field without validation. Prefer **additive migrations** preserving old rows and IDs. If a legacy record lacks new metadata, use an explicit neutral/unknown display, not a fabricated timestamp or keeper.

### Recommended network pattern

- Ordinary authenticated/authorised HTTP endpoints for creation, contribution and keep actions; perform persistent writes server-side with appropriate transactions.
- **Server-Sent Events (SSE)** for predominantly server-to-browser updates if it fits the existing stack. WebSockets or modest polling are acceptable only with a documented reason.
- Send **server-confirmed events after commit**, including stable IDs, event type and sufficient references to reconcile data. Browser must never be the source of shared truth.
- On initial load, fetch/render a canonical snapshot from the server; connect to the live event stream; on reconnect, refetch an authoritative snapshot or replay durable events correctly. Handle race conditions between snapshot and stream.
- Deduplicate via event IDs, record versions, or stable entities. Preserve ordering relevant to the story. Two simultaneously edited clients must eventually converge on the same state.
- Do not use ephemeral localStorage as the only persisted store. Local UI drafts are acceptable but must not be mistaken for accepted memories.
- Provide a server-rendered or otherwise functioning non-JavaScript path for core history and forms when reasonable for the verified stack; at minimum make server-returned `/readme/` complete.

### Performance and deployment

- Confirm actual Fly resources; respect the single machine and persistent volume documented by the repo.
- Ensure the database and any uploaded files are stored on a mounted persistent path across restarts and redeploys. If image uploads cannot be preserved safely, **disable/omit them in MVP**.
- Bound event-stream connections, memory caches, timers, rendered cards, image sizes and payloads. Disconnect cleanup is mandatory.
- On slow networks: optimistic indicators may show "sending", but never show a saved/kept success until the server confirms it.
- Avoid unnecessary continuous animation, layout shifts and heavy client bundles.
- Maintain reliable keyboard, screen-reader, mobile and `prefers-reduced-motion` experiences.

## 13. Detailed user journeys that must work

### Journey A — asynchronous Memory Relay

1. Member A enters the Village and Hanoi House.
2. A creates a memory titled "A birthday at home", with a story and optional event date.
3. The memory appears **In the Room** and persists after refresh.
4. A closes the browser.
5. Member B opens an independent Chrome profile hours later, enters Hanoi House and finds the memory.
6. B adds a distinct written perspective and explicitly chooses "Keep this together".
7. Server confirms the transition exactly once; memory appears **On the Shelf**, naming A and B and the keep date.
8. A returns after application restart and can see the original story, B's perspective, and unambiguous attribution.

### Journey B — simultaneous multi-user story

1. A and B have the same house/memory open in independent browser profiles.
2. A creates a memory; B sees it appear without refresh, normally within about one second.
3. B adds a perspective; A sees it appear without refresh.
4. B keeps the memory; A and B see the state change.
5. Both refresh; the data and state are identical to the committed database.

### Journey C — living map and presence

1. A enters Nghệ An House. B watches the Village Map.
2. B sees an updated active-house indicator without refreshing.
3. B enters the same house. A sees the co-presence indicator, with meaningful identities or accurate anonymous labels.
4. A closes their browser. After server-detected disconnect/expiry, B no longer sees A as online.
5. All persisted memories remain unchanged despite presence leaving.

### Journey D — marking from the URL alone

A new marker visits `/readme/`, reads the proposition, finds an obvious path to try the product, opens two independent Chrome profiles, and completes the core shared-memory flow without access to actual family data or hidden instructor-only credentials. Do not require a complicated setup or preexisting account.

## 14. Tests and evidence — required, not optional

Preserve all course tests and add meaningful product-specific tests under `spec/` or the current repository's testing conventions.

### Unit/integration requirements

1. Valid memory creation produces one persisted `IN_ROOM` record with creator and house.
2. Missing title/body, malformed date, invalid house and oversized content are rejected cleanly; appropriate drafts survive recoverable errors.
3. A second perspective is stored append-only with its true authenticated/pseudonymous member ID.
4. The creator's repeat keep attempt cannot count as a second distinct keeper.
5. A second distinct member's valid contribution + explicit keep changes status to `ON_SHELF` exactly once.
6. Concurrent keep attempts, duplicate HTTP requests and repeated event deliveries do not duplicate keepers or promotions.
7. The client cannot force `ON_SHELF` by submitting a chosen status or forged member ID.
8. Event dates, creation dates and keep dates remain distinct and correct.
9. New viewers reconstruct the same state and narrative after refresh, process restart and a redeploy-equivalent restart against the persistent data path.
10. The Shelf includes shelved memories and does not silently erase `IN_ROOM` memories.
11. Search/filter returns grounded records in a stable order if search is implemented.
12. XSS and common malformed-input attempts do not execute as code or corrupt storage.
13. Presence joins, timeout/cleanup and multiple-tab semantics are accurate and bounded.
14. Disconnect/reconnect restores authoritative state without missing or duplicate story content.
15. SSE/WebSocket event broadcasts only follow successful writes; failed requests do not produce false accepted events.
16. Course entry routes `/` and `/readme/` retain required server-returned HTML and heading content.
17. Existing records and legacy behaviour remain readable after additive migrations.
18. Authorization/access policy rejects an unauthorized private memory read/write if access gating is implemented.

### Browser verification

Where browser automation is available, verify **the real running app**, not just mocks:
- Separate Chrome profiles/incognito instances with separate cookies.
- Both views on screen and an actual sub-second-ish real-time update, measured rather than guessed.
- Two contributors, asynchronous completion, simultaneous submissions, dropped connection/reconnect.
- Restarts with data retained, including `IN_ROOM` and `ON_SHELF` states.
- Map navigation and memory views at desktop and narrow mobile sizes.
- Full keyboard use, focus visibility, readable contrast, screen-reader labels and reduced motion.
- Slow connection and server error handling.
- No browser console errors; no visible duplicate cards.
- No sensitive family data leaked in HTML, endpoint responses, event streams or logs.

Run `pnpm check`, `pnpm check:evidence` and other real repo checks; record the actual pass/fail/skip state. Tests must verify the **product's stated version of good** instead of checking only generic technical behaviour. Do not delete failing tests or adjust expectations merely to manufacture success.

### Human-judged goodness

Where genuine user evaluation is possible, propose simple tasks rather than fake results:
- Can someone distinguish **In the Room** from **On the Shelf** without explanation?
- Can a returning person find an old memory by place, name, or event?
- Does adding another perspective feel more valuable than adding a reaction/like?
- Does co-presence communicate useful context without interrupting people?

Provide a ready-to-run usability test protocol. Record actual participant responses only if a real session was conducted; otherwise list this as **not yet evaluated**.

## 15. Definition-of-good harness and coursework documents

The assessment expects a coherent argument, agent rules, tests and evidence, not merely finished UI.

### `README.md` and `/readme/`

- Retain the student's **own argument** for why the Village is good; the intended README is approximately **400–600 words**, with sources used to motivate the decisions and explicit alternatives/rejections.
- Align product claims with the code and `spec/`. Distinguish machine-enforced claims from qualities judged through observation/usability.
- The full README must be available at `/readme/` in its **server-rendered HTML**, with headings present and readable before entering the app.
- Improve accuracy where implementation has changed, but **do not invent citations, firsthand observations or the student's personal design rationale**. Provide a clearly marked suggested edit or TODO for the student where original authorship/research input is needed.

### `CLAUDE.md`

Preserve protected course instructions. Where permitted, add precise project invariants covering:
- Separate memory states and keeper validation.
- Append-only contributions and correct attribution.
- Persistent authoritative storage.
- Correct real-time propagation and reconnection.
- Privacy/security limits, accessibility, and refusal of manipulative social features.

### `spec/`

Add tests that enforce the invariants, especially the two-member transition, persistence, simultaneous users, and proper `/readme/` route. If the agent makes a mistake, encode the enduring correction as a relevant rule/test (without weakening existing tests).

### `PROCESS.md`, crit reflections, Git evidence

The course expects roughly **900–1100 words** in `PROCESS.md` plus genuine week 9–11 crit reflections and a traceable commit history. Preserve existing authentic writing and dated evidence. Do **not** fabricate the student's process or retroactively invent missed crits. Produce a compact factual implementation log and proposed edits the student can incorporate in their own voice. Record real trade-offs: incremental enhancement vs rewrite; SSE vs WebSockets; identity limitations; asynchronous keep rule; why no rich uploads/AI/gameplay.

If real changes to README, PROCESS or reflections would require personal input, do not silently write a fictional personal narrative. Instead flag exactly what the owner must supply.

## 16. Autonomous implementation order

**Phase 0 — Audit and baseline**  
Inspect all project instructions and code, run baseline checks, map the original data model and user flow, and write a short plan.

**Phase 1 — Memory semantics and migration**  
Introduce or align persistent `IN_ROOM` / `ON_SHELF` states, attribution, perspectives, keeper records, and safe additive migrations. Prove the database invariants through tests.

**Phase 2 — Realtime foundation and identity**  
Implement robust server-confirmed updates (prefer SSE if suitable), independent visitor/session identity, live presence, reconnection, deduplication, and proper cleanup. Prove two-browser convergence before investing heavily in visuals.

**Phase 3 — Core user-facing Memory Relay**  
Implement create, read, add perspective, explicitly keep together, error states, and the Shelf. Verify async and synchronous user journeys end to end.

**Phase 4 — Living Village visual redesign**  
Upgrade map and room UI, responsive layout, semantic HTML, visual states, subtle transition animation, text fallback and keyboard/reduced-motion support. Preserve existing routes and content.

**Phase 5 — Test, refine and document**  
Run all checks, test two real browser profiles, measure normal real-time latency where possible, inspect storage persistence, fix bugs, log real evidence, and document trade-offs.

**Phase 6 — Optional features only if P0 is complete**  
Implement Story Night first; then Chapters and search. Only consider decorative Across-Cities Threads or other P2 ideas if there is ample time.

Make small, reviewable Git commits that reflect genuine progress, without pushing to any deployment-triggering branch or deploying unless approved. Leave the main branch viable. Do not automatically run destructive "cleanup" migrations.

## 17. Explicit definition of done

The **P0 release** is complete only when all of the following are true:

- [ ] The same existing The Village project is preserved and improved, with recognizable four-house navigation.
- [ ] Two independent browser profiles can establish different application identities and enter houses.
- [ ] Presence and shared-memory changes appear in other open sessions within approximately one second under normal test conditions, without reload.
- [ ] A member can create a real, server-validated `IN_ROOM` memory and see it after refresh.
- [ ] Another distinct member can append a perspective and explicitly keep it together, even if the creator is offline.
- [ ] Only server-authorised, validated transitions lead to `ON_SHELF`; creator alone, duplicates and forged submissions cannot bypass the rule.
- [ ] The Shelf shows the memory's story, authors, keepers, house, and distinct event/record/keep dates.
- [ ] Accepted content survives an app restart and is stored in verified persistent deployment storage.
- [ ] The map and the content UI are clear, mobile-friendly, keyboard accessible and usable without decorative animation.
- [ ] The normal read/create flow survives transport interruption or falls back gracefully; reconnection restores consistent state.
- [ ] Data migration has not lost old memories, records or working core routes.
- [ ] Privacy/security claims match real implementation; demo use does not disclose real family data.
- [ ] Relevant automated and browser checks actually ran and are reported honestly; `pnpm check` and `pnpm check:evidence` pass or blockers are documented explicitly.
- [ ] `/readme/` serves the student-authored definition of good and the harness files are aligned without fabricated process evidence.

A visual redesign that lacks functioning multi-user persistence is not done. A generic synchronous guestbook with a pretty map but no meaningful shared storytelling is also not done.

## 18. Required final report from the coding agent

When implementation stops, report concisely and concretely:

1. **Repository audit:** Verified stack, baseline functionality, original data shape, constraints and baseline check results.
2. **Implemented features:** P0/P1/P2 with precise status (**implemented**, **partial**, **not started**), route/file locations and user-visible behaviour.
3. **Data changes:** New/changed schema, migration and backup assumptions; proof that legacy data was preserved.
4. **Real-time correctness:** Transport selected and rationale; identity, event ordering, duplicates, reconnect, online presence and observed latency (if actually measured).
5. **Testing:** Commands, pass/fail results, whether two independent browsers were tested, mobile/accessibility coverage, and unverified cases.
6. **Product/assessment alignment:** How the changes fulfil each "good" principle, and which statements belong in README, CLAUDE, spec and student-written PROCESS.
7. **Limitations and decisions needed:** Security/privacy trade-offs, unfinished optional work, required owner-provided research or authentic process evidence.
8. **Git summary:** Meaningful commits/branch state and confirmation of **no unapproved production deployment or destructive operations**.

Do not give a success summary that conceals omitted requirements. If a test tool is unavailable, say what was not tested and how the owner can test it.

---

## Closing direction

Build **The Village — Across the Distance**, not a generic social application. Preserve the existing foundation. Let a single person begin a memory, let another person enrich it across distance or in real time, and make their shared choice discoverable years later.

**The experience should answer, at a glance:**

> *What happened? Who added to this story? Who chose to keep it with me? Where can I find it again?*

Build that experience end-to-end. Demonstrate real multi-user behaviour, reliable real-time synchronisation, durable persistence and a defensible definition of good. Then stop, verify, and report evidence — do not pretend a beautiful mockup is a finished capstone.
