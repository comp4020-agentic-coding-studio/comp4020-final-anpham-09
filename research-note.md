# The cheap check problem

Coding agents have made writing a test as cheap as writing the code it guards.
The practitioner literature treats this as straightforwardly good, and the
economics look obvious: if verification is what makes generated code safe, then
cheaper verification should mean safer code. I want to argue the opposite is as
likely. A test that cannot fail is indistinguishable, at a glance, from one
that can — and agentic workflows produce both at the same rate, in the same
idiom, under the same green tick. The field's current advice is sound about
building verification loops and nearly silent about auditing them, and that
silence is where the next class of failure lives.

Simon Willison has written the clearest statement of the loop position. In
*Designing agentic loops* (30 September 2025) he argues that agents are "a
genuine step change" precisely because they "can now directly exercise the code
they are writing, correct errors, dig through existing implementation details,
and even run experiments." The advice that follows is to seek "problems with
clear success criteria where finding a good solution is likely to involve
(potentially slightly tedious) trial and error." Three months later, in *Your
job is to deliver code you have proven to work* (18 December 2025), he states
the standard directly: "get the system into an initial known state, exercise
the change, assert that it worked correctly."

That is good practice, and I have followed it. But notice what it assumes. The
loop closes only if the assertion is real. Willison writes as a practitioner
with decades of judgement about what proof looks like, working mostly alone on
his own projects, publishing as he goes; his standard is doing load-bearing
work that his advice does not describe how to acquire. "Assert that it worked
correctly" presumes a developer who can tell a vacuous assertion from a
substantive one. That skill is exactly what the older literature says erodes.

Bainbridge's *Ironies of Automation* (1983) made the structural case: automate
the routine part of a task and you leave the human with the part that cannot be
automated — monitoring — which is the task humans perform worst, and which they
now perform without the continuous practice that kept them competent at it. Her
irony transfers cleanly. The agent writes the code and the test; the developer
is left to judge whether the test means anything, a judgement built from years
of writing tests by hand, now exercised less often.

Parasuraman and Manzey (2010) close the obvious escape route. Reviewing
automation bias across aviation, medicine and process control, they distinguish
complacency from automation bias proper — the tendency to accept automated
output without independent verification — and report that it appears in experts
as readily as novices, worsens under cognitive load, and "cannot be prevented by
training or instructions." If that holds for agentic coding, then telling
developers to check the output more carefully is not a remedy. The remedy has to
be structural: something in the harness, not the instructions.

The counter-case deserves stating. None of this is new; testing discipline
predates agents by fifty years, and a test that asserts nothing has always been
possible. True — but two things have changed together. The cost of producing a
plausible-looking check has collapsed, while the cost of auditing one has not;
and the human whose job is now auditing is, per Bainbridge, getting worse at it.
A practice that was merely good hygiene when checks were expensive becomes
load-bearing when they are free.

So what should good practice be? One concrete standard: a check is not evidence
until it has been observed to fail for the reason it claims to guard. Break the
behaviour, watch the test go red, restore. This is cheap, it is mechanical, and
it survives the Parasuraman objection because it is a procedure rather than an
exhortation to be careful. It also has a sharper diagnostic use: when a test
refuses to fail, the reason is often not the test. Chasing one such refusal in
my own project surfaced a defect three layers away from what the test was
nominally checking.

The empirical picture is thinner than either camp admits. METR's 2025 randomised
trial found sixteen experienced open-source developers 19% slower with AI tools
while estimating they had been 20% faster — a striking result, and one that must
be cited carefully: sixteen participants, early-2025 tooling, and METR now marks
it historical. GitHub's Copilot study found large speed-ups on defined tasks.
The reconcilable claim is narrow but sufficient: self-report is unreliable about
verification cost. Developers do not notice how much checking they are doing, or
failing to do.

That is the argument for making the checking visible and procedural rather than
trusting that it happened.

## Sources

- Bainbridge, L. (1983). Ironies of Automation. *Automatica* 19(6), 775–779.
- Parasuraman, R., & Manzey, D. (2010). Complacency and Bias in Human Use of
  Automation: An Attentional Integration. *Human Factors* 52(3), 381–410.
- METR (2025). Measuring the Impact of Early-2025 AI on Experienced Open-Source
  Developer Productivity.
- Willison, S. (2025). [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/), 30 September.
- Willison, S. (2025). [Your job is to deliver code you have proven to work](https://simonwillison.net/2025/Dec/18/code-proven-to-work/), 18 December.
