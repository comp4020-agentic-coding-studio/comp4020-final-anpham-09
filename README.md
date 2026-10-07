# The village

My parents live in Nghe An, my brother's family in Hanoi, and I live in
Canberra. This is an app for the six of us. My nephew An Duy is eleven months
old: the reason it exists, and the only one of us who cannot use it.

## What good means here

We already have a group chat, so reaching each other was never the problem.
Nothing survives it. An Duy's first year is somewhere in that scroll and none
of us will ever go back far enough to find it.

Photo services fail from the other end: they keep everything, which is the same
as keeping nothing. Forty thousand files sorted by date by a machine with no
idea which ones mattered.

Sharing is solved. Keeping is not. This app is only about keeping.

> A memory is something two of you were there for.

Putting something down is not keeping it. What you place stays in the room you
put it in. It reaches that house's shelf only when somebody else was in the
room with you, and then it carries both your names and the day. Nothing is
withheld and nothing expires — being together is what makes a thing permanent.

Houses, then, and not a feed. A feed has one direction and nowhere to stand.

## What I read

**Robin Sloan, [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/) (2020).**
His app has "four daily active users, with zero churn". Six related people is a
decision, not a shortfall.

**Maggie Appleton, [Home-Cooked Software and Barefoot Developers](https://maggieappleton.com/home-cooked-software) (2024).**
Builds on Sloan: software made by people who understand the community rather
than the stack, and the glue between an idea and something that actually works.

**Frances Yates, *The Art of Memory* (1966).** Quintilian has you remember by
walking a building, forecourt to bedrooms. Rooms were a memory technology long
before they were an interface metaphor.

## What the checks enforce, and what they don't

`spec/` enforces: nothing reaches a shelf with one name on it; nobody can keep
their own thing, by any path; one person counts once; a thing placed alone
stays visible; placing works with JavaScript off; and a change reaches another
open session in under a second, measured at five milliseconds. Every test was
checked by breaking what it guards and confirming it went red. Three did not.
They were asserting nothing, and were rewritten.

Not enforced:

- The schema guarantees two different names on a shelved thing. That the second
  person was **in the room** is enforced by the interface, not the server.
- One browser is one person.
- A room shows its two hundred newest things; nothing reaches the older ones.
- A body over 280 characters is trimmed rather than refused — the one place the
  app acts without words.
- Times show in UTC. Hanoi and Nghe An run three or four hours behind
  Canberra, depending on daylight saving.

Judged, not tested: whether the village reads as a place, and whether the shelf
is worth coming back to.

## What I chose not to build

No accounts, no notifications, no direct messages. What is said in a house is
said to the house; privacy comes from where you are, not from a recipient
field. Nothing can be deleted or edited. Photos are week ten.

What I most wanted and cut was doing something together — a game, or something
made in turns. It is the obvious answer to a family in three places, and it is
a second app. Presence had to work first.
