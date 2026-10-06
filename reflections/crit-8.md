# Crit 8 — It's alive!

## The breakthrough

Checking the design against the spec before building it, instead of checking
the build against the spec afterwards.

My first concept was stricter than the one that shipped: a mark would persist
*only* if someone else was present to witness it. Co-presence wouldn't be a
feature, it would be the storage rule. I still think it's the more elegant
statement of the idea. It is also incompatible with the one line C8 actually
checks — that a stranger can visit, do the core thing, and find their trace
still there when they come back. A lone visitor's mark would have disappeared
by design, and no marker would read that as an argument; they'd read it as a
broken app.

What caught it was putting the spec and the design side by side and asking
which lines each other violated, before any code existed. The fix was better
than the original: nothing is deleted for lacking a witness, it's persisted and
labelled. Asserted and corroborated became two states the app refuses to
collapse, which says the thing I wanted to say more precisely than disappearing
ever did.

## What it changed

Every week so far I've verified the *output* — the rendered page, the audio
graph, the test that couldn't fail. This week the same instinct moved earlier,
onto the plan. An idea can be coherent, elegant, mine, and still wrong against
the contract it has to satisfy, and that's cheapest to discover while it's
still a paragraph.

I want to be the kind of developer who reads the contract before falling in
love with the design.
