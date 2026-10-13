# Crit 9 — All at once

## The breakthrough

Breaking a test and watching it not go red.

The rule in `CLAUDE.md` says a test that has never been seen to fail is not
evidence, so every new test this week got broken once before I trusted it. Four
of them didn't go red. The worst was the one guarding refusals: its regex also
matched a line the page renders unconditionally, so it passed whether the app
explained itself or silently swallowed the action. It was a green check backing
a claim in my README, and it was checking nothing.

The fourth was better still. A path-traversal test couldn't fail because
`fetch` normalises the URL before sending it, so the request never reached the
code it was testing. Chasing why it couldn't fail turned up a real bug three
layers away: the join gate was answering every unknown path with `200 text/html`
to anyone without a cookie. The app never 404'd for a stranger. Nothing else
would have found that.

## What it changed

Last week I moved checking from after the building to before it. This week the
thing being checked was the check.

The same failure caught me a third time, in a way that stung more. I verified
the restyle structurally — heading counts, no literal colours, no invented
content — reported it as done, and shipped a page where the cards were different
heights and half the layout was dead space. Every check I ran passed. I hadn't
looked at it. An took one glance and saw it immediately.

I want to be a developer who asks what a passing check would look like if the
thing were broken, and goes and looks when the answer is "the same".
