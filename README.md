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

And a room is a room: it holds furniture, not a list. The notes are on the
table, the album is on the shelf, and you go to one or the other. Each home
keeps its own album, a book per household somebody has to take down and
open. The meeting house has neither: a remark there belongs to whoever was
in the room.

A table is a surface, not storage, so it holds five notes a day — the
table's five, shared, not five each. Six of us around one table no more get
thirty notes a day than thirty plates, and a per-person five is a quota,
which is a thing an app gives you rather than a thing a room has. The day
turns and the table is clear: every note is on the note board behind it,
under the day it was left. Five is the only number here that refuses
anything, and it refuses only starting — writing your side of what is
already here is never capped.

## What I read

**Robin Sloan, [An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/) (2020).**
His app has "four daily active users, with zero churn". Six related people
is a decision, not a shortfall.

**Maggie Appleton, [Home-Cooked Software and Barefoot Developers](https://maggieappleton.com/home-cooked-software) (2024).**
Software made by people who understand the community, not the stack.

**Frances Yates, *The Art of Memory* (1966).** Quintilian has you remember by
walking a building. Rooms were a memory technology long before they were an
interface.

## What the checks enforce, and what they don't

`spec/` enforces: nothing reaches a shelf with one name on it; nobody keeps
their own thing, by any path; one person counts once; a thing placed alone
stays visible; a guest may write their side of anything and keep it, but may
not start something in a house that is not theirs; a password is never
stored, only a salted hash of one; placing and playing work with JavaScript
off; every memory kept is in the markup, so neither an album page nor a
drawer hides one from a reader with no script; the message box is nine tab
stops away rather than six hundred; five notes fill a table between
everybody and the sixth is refused in words, while a full table never stops
anybody writing their side of something; yesterday's note is off the table
and on the board; points are conserved across every move of a game; and a
change reaches another session in under a second, measured at five
milliseconds. All 241
tests were checked by breaking what they guard and confirming red. Several
didn't, so they were asserting nothing, and were rewritten.

Not enforced:

- A password proves who holds a browser; nothing proves who is at the
  keyboard. Somebody who hands over their password hands over their name.
- Ten wrong passwords a minute, per name, is as far as the app slows
  guessing down. Unlocking an account needs an address to send to, so
  there is no lockout.
- A room shows its two hundred newest things; nothing reaches the older ones.
- A body over 280 characters is trimmed, not refused — the one place the app
  acts without words.
- Times show in UTC, and so does the day a table turns over on: 7am in
  Nghe An and Hanoi, 11am in Canberra, not midnight. A local one would need
  a timezone kept per person, and an account is three things.

Judged, not tested: whether the village reads as a place, and whether the
shelf is worth coming back to.

## What I built, and what I didn't

**Ô ăn quan** is the game my parents played as children — two rows of five,
a quan at each end. A finished game is a score, not a memory, so it reaches
the shelf the way everything else does. One somebody walks away from has no
score, and the app doesn't offer to keep it.

No notifications, no *private* messages — the meeting house is a group
conversation and always was. Privacy comes from where you are, not a
recipient field. Nothing can be deleted or edited. Still cut: photo uploads,
likes, tags, the other games the mockups drew.

The meeting house looks like the group chat this app was written against,
deliberately. The chat's problem was never its shape — a bottom-anchored
scroll of short messages is what talking looks like — but that nothing said
there could become anything. So the shape is borrowed and the ending is
not: every message carries the same two-state label as everything in the
houses, and any of them can be taken up by somebody else and kept. A remark
at the table is one perspective away from being a memory.

This file said "no accounts" until the cookie turned out to be doing the job
of one, badly. Identity was the browser, so Mum on her phone and Mum on her
laptop were two people, and she could keep a thing together with herself.
The rule that a memory needs two of you was true of browsers, not people.

So you register — a name, a password, which house is yours, and nothing
else. The account is who you are on every device, which is what makes the
shelf rule a rule about people. Claiming a house needs that household's
code, since this is a public URL and anybody who found it could otherwise
put something in my parents' room; one code per house, because two people
who live somewhere share a front door. Registering without a code is a real
account that belongs to no house.

Belonging decides one thing only: whether you can **start** something
there. Anybody signed in can write their side of what is in any room and
keep it. I live alone in Canberra: if responding were the household's own
too, nothing I put down at home could ever be corroborated, and the rule
this app is built on would work for everyone except me.

JavaScript adds four things and takes none away: the typing line, the
travelling stones, the books that open, the drawers that shut. Blocked,
each is simply absent and the rest is unchanged — every action here is a
form POST, including a move.
