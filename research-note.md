# The cheap check problem

Coding agents have made writing a test as cheap as writing the code it guards.
The field treats this as straightforwardly good: if verification makes
generated code safe, cheaper verification should mean safer code. The opposite
is as likely. A test that cannot fail is indistinguishable, at a glance, from
one that can — and agentic workflows produce both at the same rate, under one
green tick. The field's advice is sound about building verification loops and
nearly silent about auditing them, and that silence is where the next failures
live.

Simon Willison states the loop position most clearly. In *Designing agentic
loops* (30 September 2025) agents are "a genuine step change" because they can
"directly exercise the code they are writing"; look for "problems with clear
success criteria." Three months later, in *Your job is to deliver code you have
proven to work* (18 December 2025), the standard: "get the system into an
initial known state, exercise the change, assert that it worked correctly."

That is good practice. But the loop closes only if the assertion is real, and
"assert that it worked correctly" presumes a developer who can tell a vacuous
assertion from a substantive one. Willison has decades of that judgement; his
advice never says how to acquire it. It is exactly the skill the older
literature says erodes.

Bainbridge's *Ironies of Automation* (1983) made the structural case: automate
the routine part and you leave the human the part that cannot be automated —
monitoring — which humans perform worst, and now without the practice that kept
them competent at it. The irony transfers exactly: the agent writes the code
and the test, and the developer judges whether the test means anything, on
judgement built by writing tests by hand and now exercised less often.

Parasuraman and Manzey (2010) close the obvious escape route. Reviewing
automation bias across aviation and medicine, they distinguish complacency from
automation bias proper — the tendency to accept automated output without
independent verification — and report that it appears in experts as readily as
novices, worsens under cognitive load, and "cannot be prevented by training or
instructions." If that holds for agentic coding, telling developers to check
more carefully is not a remedy. The remedy has to be structural: in the
harness, not the instructions.

The counter-case: none of this is new, testing discipline predates agents by
fifty years, and a test that asserts nothing has always been possible. True —
but two things changed together. The cost of producing a plausible-looking
check has collapsed while the cost of auditing one has not, and the human now
doing the auditing is, per Bainbridge, getting worse at it. What was hygiene
when checks were expensive is load-bearing when they are free.

Good practice, then, has one concrete standard: a check is not evidence until
it has been observed to fail for the reason it claims to guard. Break the
behaviour, watch the test go red, restore. It is cheap, it is mechanical, and
it survives the Parasuraman objection by being a procedure rather than an
exhortation to be careful. It has a diagnostic use too: when a test refuses to
fail, the reason is often not the test.

But the procedure is not self-verifying, and that is the gap the loop
literature leaves. Breaking a rule to confirm its test caught it, I recorded a
pass: the edit had silently failed to apply, so nothing was ever broken and the
tick attested to nothing. Each procedure opens a smaller gap above itself.

The empirical work reads as a disagreement and is not one. Peng et al. (2023) —
three of its four authors at GitHub or Microsoft — found developers 55.8%
faster with Copilot on a single synthetic task, implementing an HTTP server in
JavaScript, on a 21–89% confidence interval. Becker et al.'s 2025 METR trial
found sixteen experienced developers 19% slower on real tasks in their own
mature repositories, while estimating they had been faster. The two get cited
against each other, but Peng's task was greenfield, with nothing already built
to verify a change against; METR's developers worked where verification is the
expensive part. A third trial, 4,867 developers across three firms, sits
between at 26% more completed tasks. The caveats are real — n=16, early-2025
tooling METR itself calls historical, three unlike outcome measures — but the
spread is the argument rather than an embarrassment to it: the gains are
largest where there is least to check.

METR's perception gap is the narrow durable finding, and it generalises further
than its headline: if a developer's sense of their own speed is that
unreliable, their sense of how carefully they checked is not evidence either.
Hence making the checking visible and procedural rather than trusted.

## Sources

- Bainbridge, L. (1983). Ironies of Automation. *Automatica* 19(6), 775–779.
- Parasuraman, R., & Manzey, D. (2010). Complacency and Bias in Human Use of
  Automation: An Attentional Integration. *Human Factors: The Journal of the
  Human Factors and Ergonomics Society* 52, 381–410. doi:10.1177/0018720810376055
- Becker, J., Rush, N., Barnes, E., & Rein, D. (2025). [Measuring the Impact of
  Early-2025 AI on Experienced Open-Source Developer
  Productivity](https://arxiv.org/abs/2507.09089). arXiv:2507.09089. METR.
- Peng, S., Kalliamvakou, E., Cihon, P., & Demirer, M. (2023). [The Impact of AI
  on Developer Productivity: Evidence from GitHub
  Copilot](https://arxiv.org/abs/2302.06590). arXiv:2302.06590.
- Cui, Z., Demirer, M., Jaffe, S., Musolff, L., Peng, S., & Salz, T. (2025).
  [The Effects of Generative AI on High-Skilled Work: Evidence from Three Field
  Experiments with Software
  Developers](https://doi.org/10.1287/mnsc.2025.00535). *Management Science*.
  doi:10.1287/mnsc.2025.00535
- Willison, S. (2025). [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/), 30 September.
- Willison, S. (2025). [Your job is to deliver code you have proven to work](https://simonwillison.net/2025/Dec/18/code-proven-to-work/), 18 December.
