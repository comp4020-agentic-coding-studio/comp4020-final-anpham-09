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
table, the album is on the shelf, and you see either by going to it. Each
home keeps its own album — Nghe An's, Hanoi's, mine in Canberra — because
that is how a family keeps them: a book per household that somebody has to
take down and open. The meeting house has neither. A remark there belongs
to whoever was in the room, and giving it a book would make it a fourth
home it was never meant to be.

A table is a surface, not storage, so it holds five notes a day each. The
day turns and it is clear: every note is on the note board behind it, under
the day it was left. Nothing is swept there — being on the table means
having been left today, which the timestamp already answers. Five is the
only number here that refuses anything, and it refuses only starting:
writing your side of what is already here is never capped, or a busy
Tuesday could stop a memory being a memory.

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
stops away rather than six hundred; the sixth note of a day is refused in
words, while a full table never stops anybody writing their side of
something; yesterday's note is off the table and on the board; a page is
gzipped for a browser that asks and sent plain to one that refuses; points
are conserved across every move of a game; and a change reaches another
session in under a second, measured at five milliseconds. All 241
tests were checked by breaking what they guard and confirming red. Several
didn't, so they were asserting nothing, and were rewritten.

Not enforced:

- A password proves who holds a browser; nothing proves who is at the
  keyboard. Somebody who hands over their password hands over their name.
- Ten wrong passwords in a minute, per name, is as far as the app slows
  guessing down. There is no lockout: unlocking one needs an address to
  send to, and this app has none.
- A room shows its two hundred newest things; nothing reaches the older ones.
- A body over 280 characters is trimmed, not refused — the one place the app
  acts without words.
- Times show in UTC, and so does the day a table turns over on: 7am in
  Nghe An and Hanoi, 11am in Canberra, not midnight. A local one would need
  a timezone kept per person, and an account is three things.

Judged, not tested: whether the village reads as a place, and whether the
shelf is worth coming back to.

## What I built, and what I didn't

A game was the thing I most wanted and nearly cut; it was a sequence, not a
cut. **Ô ăn quan** is the game my parents played as children — two rows of
five, a quan at each end. A finished game is a score, not a memory, so it
reaches the shelf the way everything else does. A game somebody walks away from has no
score, and the app doesn't offer to keep it.

No notifications, no *private* messages — the meeting house is a group
conversation and always was. Privacy comes from where you are, not a
recipient field. Nothing can be deleted or edited. Still cut: photo uploads,
likes, tags, the other games the mockups drew.

The meeting house looks like the group chat this app was written against,
deliberately. The problem with the
chat was never its shape — a bottom-anchored scroll of short messages is
simply what talking looks like — it was that nothing said there could ever
become anything. So the shape is borrowed and the ending is not: every
message here carries the same two-state label as everything in the houses,
and any of them can be taken up by somebody else and kept. A remark at the
table is one perspective away from being a memory, which is why the
keep-together control is on every message rather than behind a menu.

This file said "no accounts" until the cookie turned out to be doing the job
of one, badly. Identity was the browser, so Mum on her phone and Mum on her
laptop were two people, and she could keep a thing together with herself.
The rule that a memory needs two of you was true of browsers, not people.

So you register: a name, a password, and which house is yours. Nothing else
— no email, no reset, no profile. The account is who you are on every
device, which is what makes the shelf rule a rule about people.

Claiming a house needs that household's code, because this is a public URL
and without one anybody who found it could put something in my parents'
room. One code per house rather than per person: two people who live
somewhere share a front door. Registering without a code is a real account
that belongs to no house.

Belonging to a house decides one thing only: whether you can **start**
something there. Anybody signed in can write their side of what is in any
room and keep it together, which is deliberate. I live alone in Canberra:
if responding were the household's own too, nothing I put down at home
could ever be corroborated, and the rule this app is built on would work
for everyone except me.

One concession to JavaScript: the line saying somebody is typing. With a
script blocked it never appears and nothing else changes — every action here
is a form POST, including a move.
