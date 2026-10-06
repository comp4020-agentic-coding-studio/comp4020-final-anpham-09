# Process overview

## What I'm building

[Corroborated](https://comp4020-final-anpham-09.fly.dev/) is a log of small
claims about shared spaces at ANU, where the app's only job is to keep two
things apart: something one person said, and something other people have also
said they saw. It never calls anything verified.

That definition of good didn't arrive this week. It's the same idea I've been
circling since crit 1, when `pnpm check` was green while the page's captions
were clipped off at 390×844, and again in crit 5, where a test passed because
the condition it asserted was impossible rather than because the rule held. The
final project is the first brief where that idea can be the subject rather than
the method.

## The stack, and what it cost

**Context.** `fly.toml` fixes one shared-cpu-1x machine with 256 MB and one
volume at `/data`; there is no separate database server. The repo's harness
is already Node: `tsc --noEmit`, Vitest, a `pnpm check:evidence` script, and
a shipped `spec/` that runs over HTTP against the running app. For COMP8020
the project's marks are 35% process, 25% research note, 20% response to the
brief and 20% the deployed app — so four-fifths of it is argument and writing.

**Options.** Go with SQLite would fit 256 MB more comfortably and ship a single
binary. Deno with Deno KV would need no package manager. Node would need
neither to be learned.

**Decision.** Node, running TypeScript directly — no build step, no bundler,
no framework — with `better-sqlite3` on the volume. The deciding argument
wasn't performance: it was that the harness I'm marked against is Node, so Go
or Deno wouldn't *replace* a toolchain, they'd add a second one beside the one
I still have to keep green for eleven weeks. `tsconfig.json`'s own comment
points the same way: "imports name the file they mean, extension and all —
which is what node itself wants when it runs a .ts file directly." Spending the
project's scarcest resource — writing time — on runtime novelty would buy marks
in the 20% and cost them in the 80%.

**What it costs, honestly.** No framework means I hand-roll routing, form
parsing and HTML; no ORM means raw SQL. Both are fine at two tables and would
not be at twenty. `better-sqlite3` is a native module, which forced a
decision I'd otherwise have skipped (below). If the app outgrows this, the
brief allows switching and writing a new record saying why.

## How the work actually went

**Deploy first, before choosing anything.** The brief says to deploy on day one
so the path is known to work. Doing that surfaced the first problem immediately:
the Fly token for this repo wasn't on disk. I'd pasted it into my crit-7 repo
by mistake a week earlier, and overwritten it there with the correct one, so the
only copy was in an Ed message. The placeholder went up before a line of app
code existed, and the shipped invariants were run against the live URL rather
than a local stand-in. Everything after that was additive.

**The first design would have failed the spec, and reading the spec caught it.**
My first concept was stricter: a mark would persist *only* if someone else was
present to witness it. It's a cleaner statement of the idea, and it is
incompatible with C8's spec line — "a stranger can visit, do the core thing, and
find their trace still there when they come back." A lone visitor's trace would
have vanished by design, which reads as a broken app rather than an argument.
The fix made the design better: nothing is ever deleted for lacking a witness;
it's persisted and *labelled*. Asserted and corroborated became two states the
app refuses to collapse, which is a sharper version of the original idea
([`6bbe939`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/6bbe939)).

**Two rules moved into the schema.** A claim cannot be its own witness, and one
person is one witness however many times they click. Both could have lived in a
code path; `UNIQUE (claim_id, author)` and an explicit author check put them
where they can't be forgotten. Both refusals are explained in words rather than
silently dropped — an action that does nothing teaches you the system is broken,
where "a claim can't be its own witness" teaches you the rule.

**I broke both core tests on purpose before trusting them.** Removing the
self-witness guard turned exactly one test red; swapping the database for
`:memory:` turned exactly one other red. This is the habit crit 5 taught me,
and it is the only reason I believe the suite means anything.

**Two corrections landed in the harness, not in a retry.** The first: a commit
staged `.data/app.db` — the local SQLite file — and `.idea/`, which records
the absolute path of this checkout, into a repo that goes public today. The fix
was `.gitignore` plus untracking, and it's verifiable: those paths appear in
no reachable commit. The second: `pnpm-workspace.yaml` ships with
`better-sqlite3: set this to true or false`, and `pnpm install` exits 1
until it's answered. That's the template asking a question, not a bug, and the
answer is recorded in the file with its reasoning, because a blocked native
build fails at boot in the Fly image rather than at install on my laptop.

**A source got dropped for not resolving.** I planned to cite four things in
`README.md`. One, `runyourownsocial.com`, wouldn't resolve on two attempts,
so it isn't cited. Citing an unreachable source in a document arguing that
systems shouldn't assert what they can't show would have been self-refuting
([`7eb9578`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/commit/7eb9578)).

## What the checks protect

`spec/` holds four of my own: a claim with no corroboration never renders as
corroborated; an author cannot corroborate their own claim; one person counts
once; and a claim with its corroborations survives a restart — tested by
reopening the same database file, not by asserting a row exists. The shipped
invariants stay as shipped.

## What's next, and what's still thin

Week 10 makes it real-time, and the data model already anticipates it:
corroboration is an event with an author and a time, not a boolean, so week 11's
logging has something real to narrate. Two honest gaps. There's no CSRF check —
deliberate, since there are no accounts and no privileged action, so a forged
post is just a post anyone could make, but it's a decision and not an oversight.
And the commit history is thin at
[`23d294e...7eb9578`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-anpham-09/compare/23d294e...7eb9578): this was built in one
long session, and the next crits should leave a better trail.
