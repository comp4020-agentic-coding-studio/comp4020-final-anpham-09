# The village

My parents live in Nghe An, my brother's family in Hanoi, and I live in
Canberra. This is an app for the six of us. My nephew An Duy is eleven months
old: the reason it exists, and the only one who cannot use it.

## What good means here

We already have a group chat, so reaching each other was never the problem.
Nothing survives it. An Duy's first year is somewhere in that scroll and none
of us will go back far enough to find it.

Photo services fail from the other end: they keep everything, which is the
same as keeping nothing — forty thousand files sorted by date by a machine
with no idea which mattered.

Sharing is solved. Keeping is not. This app is only about keeping.

> A memory is something two of you were there for.

Putting something down is not keeping it. What you place stays in the room you
put it in, and reaches that house's shelf only when somebody else writes their
own side of it and chooses to keep it together. Then it carries both names and
the day. Nothing is withheld and nothing expires.

Houses, then, not a feed. A feed has one direction and nowhere to stand.

## What I read

**Robin Sloan, [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/) (2020).**
His app has "four daily active users, with zero churn". Six related people is
a decision, not a shortfall.

**Maggie Appleton, [Home-Cooked Software and Barefoot Developers](https://maggieappleton.com/home-cooked-software) (2024).**
Software made by people who understand the community, not the stack.

**Frances Yates, *The Art of Memory* (1966).** Quintilian has you remember by
walking a building. Rooms were a memory technology long before they were an
interface.

## What the checks enforce, and what they don't

`spec/` enforces: nothing reaches a shelf with one name on it; nobody keeps
their own thing, by any path; one person counts once; a thing placed alone
stays visible; placing and playing work with JavaScript off; points are
conserved across every move of a game; and a change reaches another session in
under a second, measured at five milliseconds. All 150 tests were checked by
breaking what they guard and confirming red. Several didn't, so they were
asserting nothing, and were rewritten.

Not enforced:

- One browser is one person. Nothing proves who holds it.
- A room shows its two hundred newest things; nothing reaches the older ones.
- A body over 280 characters is trimmed, not refused — the one place the app
  acts without words.
- Times show in UTC. Hanoi and Nghe An run three or four hours behind
  Canberra.

Judged, not tested: whether the village reads as a place, and whether the
shelf is worth coming back to.

## What I built, and what I didn't

This file used to call a game the thing I most wanted and cut. It was a
sequence, not a cut: presence worked first, then the table got a board. **Ô ăn
quan** is the game my parents played as children — two rows of five, a quan at
each end. A finished game is a score, not a memory, so it reaches the shelf
the same way everything else does. A game somebody walks away from has no
score, and the app doesn't offer to keep it.

No notifications, no *private* messages — the meeting house is a group
conversation and always was. Privacy comes from where you are, not a
recipient field. Nothing can be deleted or edited. Still cut: photo uploads,
likes, tags, the other games the mockups drew.

This file said "no accounts" until C10, and the app still has none — but it
now has keys. Each of the five adults has their own; a visitor needs nothing
and is never asked for anything. A key is not an account: no sign-up, no
email, no reset, no profile, and nothing kept about anyone beyond the name
they chose. It exists because a home needed a server-side answer to who may
put something down in it, and "whoever has the URL" was the wrong answer.
An Duy is eleven months old and has no key — he is who the village is for,
not someone who uses it.

One concession to JavaScript: the line saying somebody is typing. With a
script blocked it never appears and nothing else changes — every action here
is a form POST, including a move.
