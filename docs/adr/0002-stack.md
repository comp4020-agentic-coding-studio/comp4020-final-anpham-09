# ADR 0002 — The stack

**Status:** accepted 7 October 2026 ([`6bbe939`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/6bbe939), the commit that
put the one runtime dependency in `package.json`), still in force. Written
down 9 November 2026, a month after the fact — the choice was made early and
defended in commit messages all along, but not recorded in one place until
now. That ordering is itself a finding, and "Consequences" says what it cost.

## Context

Three things were fixed before I chose anything. `fly.toml` gives one
`shared-cpu-1x` machine with **256MB of memory**, one 1GB volume mounted at
`/data`, and `auto_stop_machines = "stop"` with `min_machines_running = 0` —
so the machine *will* be stopped when a marker returns the next day, and the
app has to survive that. The brief adds two more: a change must reach every
other open session in about a second, and what people do has to still be
there across sessions, restarts and redeploys.

Against that, the mark is mostly writing. For COMP8020 the project splits
process 35%, deployed app 20%, response to the brief 20%, with the research
note the remaining quarter — so roughly four-fifths of it is argument rather
than artefact. A stack that needed explaining would spend the budget in the
wrong place.

So the governing constraint was not "what is the best stack". It was: **what
is the smallest stack that still meets three hard requirements on a machine
that stops?** Every choice below follows from treating "boring" as the
objective rather than the consolation.

## Decision

**Node 24, running TypeScript directly, with no build step.** Node's native
type stripping means `node src/server.ts` is the whole run command
(`Dockerfile` `CMD`). `tsc --noEmit` still runs in `pnpm check`, so types are
checked but never compiled. There is no bundler, no transpile output and no
`dist/` to get stale.

**`better-sqlite3` as the only runtime dependency.** `package.json` lists
exactly one entry under `dependencies`. The database is one file on the
volume; persistence is a file surviving a restart rather than a service to
configure. It is synchronous by design, which on a single-core machine with
no concurrency to protect is a simplification rather than a cost.

**Server-sent events, not WebSockets.** Every action in this app is already a
plain form POST, so the client never needs to *send* on a socket — the server
only has to say "something changed" and let the page re-fetch. SSE is one
`text/event-stream` response and an `EventSource`; it reconnects by itself,
and it survives the machine stopping without any reconnect logic of mine.

**Vitest, with the suite split between isolated-database tests and live-HTTP
tests** against a real server (`spec/global-setup.ts`).

**No framework, no client-side rendering.** The app is server-rendered HTML
and form POSTs. JavaScript is the exception, not the medium: three uses, each
argued in `CLAUDE.md` *before* being built.

## Options not taken

**WebSockets.** Rejected because nothing in this app sends from the client.
A duplex channel would add a protocol upgrade, a heartbeat and reconnect
handling to deliver a message whose entire content is "re-fetch". The cost
is real and the capability is unused.

**Polling fast enough.** The brief explicitly permits it. Rejected on the
256MB machine: polling costs a request per client per interval whether or
not anything changed, and the room pages are large (the meeting house
measured 316KB before compression, [`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)). SSE costs one idle socket and
sends bytes only when something actually happened.

**Postgres on Fly.** Rejected as a second machine, a second failure mode and
a connection pool, to hold data that fits in a file. Nothing here needs
concurrent writers; one small family is the entire user base.

**A framework (Next, Remix, Express).** Rejected because it would make the
stack the interesting part. The node standard library already answers
requests, and a framework's main gift — routing and rendering conventions —
is the part I most wanted to argue about in `CLAUDE.md` rather than inherit.

**A build step, with bundling and minification.** Rejected because it buys
bytes I later got more cheaply: gzip in the `html()` helper took the meeting
house from 316KB to 31KB, 90% fewer bytes, with no build artefact to keep in
sync ([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)).

## Consequences

**The real-time requirement is met with room to spare, and measured rather
than asserted.** `spec/realtime.test.ts` drives two live sessions and fails
if a change does not reach the second one inside the brief's second; the
abort timer starts before the settle, so the deadline it actually enforces
is ~900ms, stricter than the brief ([`b637dc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/b637dc7)). Observed propagation is
about 5ms.

**One runtime dependency means the exceptions are visible.** Because there is
no framework to hide in, every piece of JavaScript had to be argued for in
`CLAUDE.md` before it was built. That rule only has force because the default
is "no JavaScript", which is a property of this stack rather than of my
discipline.

**The 256MB machine shows up in the code, not just the config.** A stream
costs an open socket, a listener and a timer for as long as it is held, and
joining is free and unlimited — so `src/events.ts` caps concurrent streams
and returns `null` rather than a no-op unsubscribe when the cap is reached,
forcing every caller to handle refusal. A bigger machine would not have
required that design.

**Compression had to be chosen per-response, not globally.** Fly's proxy
adds no `content-encoding`, so every rendered byte was a sent byte. Gzip went
into `html()` only, and deliberately *not* onto the event stream: compressing
SSE buffers it, which would have quietly broken the one-second requirement.
The realtime spec passing is how I know it did not ([`74fc5c3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/74fc5c3)).

**The cost of no build step is paid in template literals.** `src/render.ts`
holds the markup, the whole stylesheet and the client scripts in one file as
tagged strings. A stray backtick inside a comment inside a template literal
broke `tsc` four separate times. A bundler would have caught those earlier;
I judged four compile errors cheaper than a build pipeline, but it is a cost
and not a free win.

**Writing this ADR a month late was itself a mistake.** ADR 0001 was written
when the workflow decision was made; this one was not, and in the interval
`PROCESS.md` carried the stack case in a single paragraph that asserted the
choices without weighing the alternatives. The trade-offs above were all
real and all defended in commit messages at the time — but a trade-off that
lives only in a commit body is hard to find, which is the gap an ADR exists
to close.

## Not recorded here

Why the app is what it is, rather than how it is served — that argument is
`README.md`'s. How the agent work is organised is [ADR 0001](0001-agent-workflow.md).
