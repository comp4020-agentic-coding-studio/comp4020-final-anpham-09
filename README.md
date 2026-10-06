# Corroborated

Small claims about shared spaces at ANU. The Marie Reay lifts are out again.
There's a queue at Daily Market. The cockatoos are on Union Court. Anyone can
post one; anyone else can say they saw it too.

Nothing here is verified. A claim is either something one person said, or
something other people have also said they saw — and those are different
things. Keeping them apart is the whole app.

## What good means here

Good is that the app never claims more than it can show.

Software collapses "recorded" and "true" the moment it has a database. A row
exists, so the thing happened. Most interfaces then present stored and
confirmed identically, and the reader has no way to tell which they're looking
at. That collapse is the failure this app is built against.

So there are exactly two states, and the app says which one it's in. A claim
nobody else has seen reads **asserted**. A claim others have seen reads
**corroborated**, with the number of people. The word *verified* appears
nowhere in the interface, because the app cannot know that. It knows how many
people said they saw something, which is a smaller and more honest claim.

Two rules make that label mean something, and both live in the schema rather
than only in a code path that can be forgotten:

- **A claim cannot be its own witness.** Its author can't corroborate it.
- **One person is one witness**, however many times they click.

Refusals are explained rather than dropped. Clicking a thing that does nothing
teaches you the system is broken; being told "a claim can't be its own witness"
teaches you the rule.

## What I read

**Robin Sloan, [*An app can be a home-cooked meal*](https://www.robinsloan.com/notes/home-cooked-app/)
(2020)** — his messaging app has "four daily active users, with zero churn".
This is for a few dozen people who share a campus, not for everyone, and that's
a design decision rather than a shortfall.

**[Wikipedia:Verifiability](https://en.wikipedia.org/wiki/Wikipedia:Verifiability)** —
"verifiability means that people can check that facts or claims correspond to
reliable sources". Wikipedia retired its old slogan *verifiability, not truth*
because readers misread it. That retirement is the sharper lesson: naming the
distinction badly is worse than not naming it, which is why this app labels
states rather than sloganeering about them.

**The [Verification Handbook](https://verificationhandbook.com/)** — corroboration
is a practice, not a property. You don't verify a thing once; you accumulate
independent accounts. The data model follows: corroboration is an event with an
author and a time, not a boolean on the claim.

## What the checks enforce, and what they don't

`spec/` enforces: a claim with no corroboration never renders as corroborated;
an author cannot corroborate their own claim; one person counts once; a claim
and its corroborations survive a restart. Each of those tests was checked by
breaking the code and confirming the test went red.

Judgement, left to the crit: whether the labels read honestly to someone who
doesn't know the rules, and whether the thing is worth using with other people
in the room.

## What I chose not to build

No accounts — a cookie pseudonym is enough to tell two people apart, and
anything more would collect what the app doesn't need. No deletion, no editing:
the record is what was said. No disagreeing with a claim, because a denial is
also a claim and would need its own witnesses. No real-time yet; that's week 10.
