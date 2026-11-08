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

And three albums, not one wall. Each home keeps its own — Nghe An's, Hanoi's,
mine in Canberra — because that is how a family actually keeps them: a book
per household, on a shelf, that somebody has to take down and open. The
meeting house has no album. A remark at the table belongs to whoever was
there rather than to a house, and giving it a book would make the table into
a fourth home it was never meant to be.

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
stays visible; a guest may write their side of anything and keep it, but may
not start something in a house that is not theirs; a password is never
stored, only a salted hash of one; placing and playing work with JavaScript
off; the message box at the table is reachable in nine tab stops rather than
six hundred; a page is gzipped for a browser that asks and sent plain to one
that refuses; points are conserved across every move of a game; and a change
reaches another session in under a second, measured at five milliseconds. All 216
tests were checked by breaking what they guard and confirming red. Several
didn't, so they were asserting nothing, and were rewritten.

Not enforced:

- A password proves who holds a browser; nothing proves who is at the
  keyboard. Somebody who hands over their password hands over their name.
- Ten wrong passwords in a minute, per name, is as far as the app slows
  guessing down. There is no lockout, because locking an account needs a
  way to unlock it and this app has no addresses to send one to.
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

The meeting house looks like the group chat this app was written against,
and that is deliberate rather than a contradiction. The problem with the
chat was never its shape — a bottom-anchored scroll of short messages is
simply what talking looks like — it was that nothing said there could ever
become anything. So the shape is borrowed and the ending is not: every
message here carries the same two-state label as everything in the houses,
and any of them can be taken up by somebody else and kept. A remark at the
table is one perspective away from being a memory. That is the whole
difference, and it is why the keep-together control stays visible on every
message instead of being tucked behind a menu to look tidier.

This file said "no accounts" until the cookie turned out to be doing the job
of one, badly. Identity was the browser, so Mum on her phone and Mum on her
laptop were two people: she could place a thing and then keep it together
with herself, and the shelf would show her name on both sides. The rule that
a memory needs two of you was true of browsers, not of people.

So you register: a name, a password, and which house is yours. Nothing else
— no email, no reset, no profile. The account is who you are, the same on
every device, and that is what makes the shelf rule a rule about people.

Claiming a house needs that household's code, because this is a public URL
and without one anybody who found it could put something in my parents'
room. One code per house rather than per person: two people who live
somewhere share a front door. Registering without a code is a real account
that belongs to no house.

Belonging to a house decides one thing only: whether you can **start**
something there. Anybody signed in can write their side of what is already
in any room and keep it together — and that is deliberate, not a loose end.
I live alone in Canberra. If responding were also the household's own,
nothing I put down at home could ever be corroborated, and the one rule
this whole app is built on would work for everyone except me.

An Duy is eleven months old and has no account — he is who the village is
for, not somebody who uses it.

One concession to JavaScript: the line saying somebody is typing. With a
script blocked it never appears and nothing else changes — every action here
is a form POST, including a move.
