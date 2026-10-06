# Crit 8 — It's alive!

## The breakthrough

Putting the spec next to the design before either one existed in code.

My first version of this app was stricter. A mark would persist only if
somebody else was there when it was made — co-presence as the storage rule
rather than a feature on top of one. I still think that's the better sentence.
It also breaks the one line C8 actually checks: a stranger visits, does the
core thing, comes back, and the trace is still there. Mine would have deleted
it. Not as a bug — as the design working exactly as written.

I caught it by reading the spec and the design side by side and looking for
the line where they contradicted each other. That took about ten minutes. It
would have cost me the week.

The replacement is better than what it replaced. Nothing is deleted for
lacking a witness now; it's kept and labelled. Asserted and corroborated are
two states the app refuses to merge, and that says the thing I wanted to say
more exactly than deleting it ever did.

## What it changed

Every week so far I've checked the work after building it — the page at
390×844, the pitch the synth actually produced, the test that turned out to be
impossible to fail. This is the first week the checking happened before the
building instead of after it.

It's much cheaper there. I don't think I'd have known to do it without seven
weeks of doing it the expensive way first.
