# Crit 10 — Fly by instruments

## The breakthrough

Every check I ran this week confirmed a proxy for the thing, never the thing.

The suite was 150 green when I added the rule deciding who may change a
house. All 150 ran with no keys cut, so `mayChange` returned on its first
line and the branch that refuses a visitor never executed once. The log was
the entire point of the crit, and nothing asserted it said anything — every
`logAction` could have been deleted and the suite stayed green. The guard on
the secret checked that it parsed, not that the values were hashes, so
setting it with the placeholders still in it closed every home and opened
none, locking the family out of their own houses while looking like a
working app.

Then the same shape twice more in an hour. I confirmed the login was live
because the HTML contained `href="/key"`; I still couldn't find it on the
screen. I confirmed unlocking worked because the log said `key-accepted` and
the redirect said "Welcome home, Mum" — and the next page said "visiting",
because `getPerson` never selected the column it was written to. One
existing test was passing *because* of that bug.

The instrument that earned its place was the one that could be wrong. When
the secret was bad the log named all five people, and that is the only
reason it was fixable at one in the morning.

## What it changed

Last week the thing being checked was the check. This week it was the
distance between what I checked and what someone would actually do.

I want to be a developer who closes that distance before claiming anything,
and who opens the page.
