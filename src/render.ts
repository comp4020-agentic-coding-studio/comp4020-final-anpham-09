import type { House } from "./houses.ts";
import type { Person } from "./people.ts";
import type { ThingView } from "./things.ts";

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fonts load over the network with `display=swap`; every fallback below is
 *  chosen for metric compatibility so a slow connection or a blocked CDN
 *  still lands on a readable page, not a layout-shifted or blank one. */
const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600&display=swap" rel="stylesheet">`;

const STYLE = `
:root {
  --paper:#FBF8F2; --card:#F4EFE6; --card-raised:#EDE4D6; --rule:#E2D5C3;
  --ink:#2C2421; --ink-soft:#56423D;
  --hearth:#C86446; --hearth-deep:#9A3E23; --on-hearth:#FFFFFF;
  --sage:#5F7464; --sage-deep:#3E5343;
  --amber:#D9933B; --amber-deep:#8F5B19;
  --shadow-1:0 2px 8px -2px rgba(44,36,33,.05), 0 4px 16px -4px rgba(44,36,33,.06);
  --shadow-2:0 4px 12px -2px rgba(44,36,33,.08), 0 8px 24px -4px rgba(44,36,33,.08);
  --display:"Merriweather",Georgia,"Times New Roman",serif;
  --body:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    /* Warm ink-wood base, not grey. Terracotta is lifted (toward the
       reference's own --inverse-primary) rather than darkened, since a
       darkened terracotta on a dark ground reads muddy rather than warm. */
    --paper:#1A1512; --card:#241D19; --card-raised:#2E2520; --rule:#3E322B;
    --ink:#F2E7DF; --ink-soft:#C3AFA5;
    --hearth:#E8927A; --hearth-deep:#FFB59F; --on-hearth:#2C2421;
    --sage:#A8C4AE; --sage-deep:#CBDCCF;
    --amber:#E8B877; --amber-deep:#FFD9A8;
    --shadow-1:0 2px 8px -2px rgba(0,0,0,.35), 0 4px 16px -4px rgba(0,0,0,.40);
    --shadow-2:0 4px 12px -2px rgba(0,0,0,.45), 0 8px 24px -4px rgba(0,0,0,.50);
  }
}
* { box-sizing: border-box; }
html { background: var(--paper); }
body { margin: 0 auto; padding: 0 0 4rem; max-width: 72rem;
  font: 16px/1.5 var(--body); color: var(--ink); background: var(--paper); }
a { color: var(--hearth-deep); }
main { padding: 0 1.25rem; }
@media (min-width: 768px) { main { padding: 0 2rem; } }

/* Chrome: a slim header, then the four-link nav, on every page. */
header.chrome { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
  gap: .5rem 1rem; padding: 1.25rem 1.25rem .75rem; }
@media (min-width: 768px) { header.chrome { padding: 1.5rem 2rem .75rem; } }
.brand { font-family: var(--display); font-weight: 700; font-size: 1.375rem; color: var(--hearth); margin: 0; }
.whoami { margin: 0; font-size: .875rem; color: var(--ink-soft); }
.whoami strong { color: var(--ink); }
nav.site { display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; padding: 0 1.25rem .9rem; border-bottom: 1px solid var(--rule); }
@media (min-width: 768px) { nav.site { padding: 0 2rem .9rem; } }
nav.site a { display: inline-flex; align-items: center; min-height: 44px; padding: .2rem 0;
  font-weight: 600; font-size: .9375rem; color: var(--ink-soft); text-decoration: none; }
nav.site a:hover { color: var(--hearth-deep); }

h1 { font-family: var(--display); font-weight: 700; font-size: 2.75rem; line-height: 3.5rem;
  letter-spacing: -0.02em; margin: 1.5rem 0 .5rem; color: var(--ink); }
h2 { font-family: var(--display); font-weight: 700; font-size: 2rem; line-height: 2.75rem;
  letter-spacing: -0.01em; margin: 2rem 0 .5rem; color: var(--ink); }
h3 { font-family: var(--display); font-weight: 700; font-size: 1.5rem; line-height: 2.125rem;
  margin: 1.5rem 0 .5rem; color: var(--ink); }
@media (max-width: 640px) {
  h1 { font-size: 2rem; line-height: 2.625rem; letter-spacing: -0.01em; }
  h2 { font-size: 1.625rem; line-height: 2.25rem; letter-spacing: 0; }
}
p { margin: 0 0 .75rem; }
.lede { color: var(--ink-soft); font-size: 1.125rem; line-height: 1.75rem; margin-top: 0; }
.note { color: var(--ink-soft); font-size: .875rem; }
.empty { color: var(--ink-soft); }
.quiet { color: var(--ink-soft); font-size: .875rem; font-style: italic; }

form { display: grid; gap: .6rem; margin: 1.25rem 0; }
label { font-weight: 600; font-size: .9375rem; }
input, button, select, textarea { font: inherit; padding: .65rem .8rem; min-height: 44px;
  border: 1.5px solid var(--rule); border-radius: .5rem; background: var(--paper); color: var(--ink); }
button { cursor: pointer; font-weight: 600; }
button.primary { background: var(--hearth); color: var(--on-hearth); border: none;
  box-shadow: 0 -2px 0 color-mix(in srgb, var(--ink) 15%, transparent) inset; }
button.primary:hover { background: var(--hearth-deep); }
:is(a, button, input, select, textarea):focus-visible {
  outline: none; border-radius: .5rem;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hearth) 20%, transparent);
}

ol { list-style: none; padding: 0; margin: 0; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
.state { font-weight: 600; font-size: .875rem; letter-spacing: .02em; }
.state[data-state="in-the-room"] { color: var(--amber-deep); }
.state[data-state="on-the-shelf"] { color: var(--sage-deep); }
.here { color: var(--ink-soft); font-size: .9375rem; }

/* Parchment cards. */
.card { background: var(--card); border: 1px solid var(--rule); border-radius: 1rem;
  box-shadow: var(--shadow-1); padding: 1.25rem; }
.card-raised { background: var(--card-raised); border: 1px solid var(--rule); border-radius: 1rem;
  box-shadow: var(--shadow-2); padding: 1.25rem; }
.eyebrow { display: block; font-size: .8125rem; font-weight: 600; letter-spacing: .04em;
  text-transform: uppercase; color: var(--sage-deep); margin-bottom: .25rem; }
.dashed-rule { border: none; border-top: 1px dashed var(--rule); margin: 1rem 0; }
.chip { display: inline-flex; align-items: center; gap: .3rem; padding: .25rem .75rem;
  border-radius: .5rem; font-size: .8125rem; font-weight: 600; }
.chip-home { background: color-mix(in srgb, var(--sage) 16%, var(--card)); color: var(--sage-deep); }

/* The village map. */
ul.village { list-style: none; padding: 0; margin: 1.25rem 0; display: grid; gap: 1.25rem;
  grid-template-columns: repeat(2, 1fr); }
@media (max-width: 640px) { ul.village { grid-template-columns: 1fr; } }
li.house { list-style: none; }
a.house-card { display: block; min-height: 44px; text-decoration: none; color: inherit; }
a.house-card:hover .card { box-shadow: var(--shadow-2); }
a.house-card h2 { font-size: 1.5rem; line-height: 2rem; margin: 0 0 .75rem; }

/* The CSS-drawn placeholder panel — decorative, never a photograph. */
.placeholder { --tint: var(--hearth); aspect-ratio: 16 / 10; border-radius: 1rem; position: relative;
  overflow: hidden; box-shadow: inset 0 0 0 1px var(--rule);
  background-image:
    radial-gradient(ellipse at 75% 20%, color-mix(in srgb, var(--tint) 30%, transparent) 0%, transparent 55%),
    linear-gradient(135deg, color-mix(in srgb, var(--tint) 32%, var(--card)) 0%,
      color-mix(in srgb, var(--tint) 10%, var(--paper)) 55%, var(--card-raised) 100%); }
.placeholder-caption { font-style: italic; color: var(--ink-soft); font-size: .875rem; margin: .5rem 0 1rem; }

/* Memory slips, alternately tilted as handwritten note slips. */
li.thing { list-style: none; background: var(--card); border: 1px solid var(--rule); border-radius: .75rem;
  box-shadow: var(--shadow-1); padding: 1rem 1.1rem; margin: 0 0 1rem; }
li.thing:nth-of-type(odd) { transform: rotate(-0.4deg); }
li.thing:nth-of-type(even) { transform: rotate(0.4deg); }
li.thing:has(.state[data-state="on-the-shelf"]) { border-left: 3px solid var(--sage); }
li.thing:has(.state[data-state="in-the-room"]) { border-left: 3px solid var(--amber); }
.body { font-size: 1.0625rem; margin: 0 0 .35rem; }
.meta { color: var(--ink-soft); font-size: .8125rem; margin: 0 0 .5rem; }

/* The house page's two-column layout. */
.layout-house { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; align-items: start; }
@media (max-width: 768px) { .layout-house { grid-template-columns: 1fr; } }
.panel-stack { display: grid; gap: 1.25rem; }
.rule-title { margin: 0 0 .5rem; font-size: 1.125rem; }
.consequence { font-size: .9375rem; }

blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid var(--rule); color: var(--ink-soft); }
blockquote p { margin: .4rem 0; }
main :is(h2,h3) { margin-top: 2rem; }

@media (prefers-reduced-motion: no-preference) {
  a.house-card { transition: transform .15s ease; }
  a.house-card:hover { transform: translateY(-2px); }
}
`;

export function page(title: string, inner: string, me?: Person | null): string {
  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${FONTS_HEAD}
<title>${esc(title)}</title><style>${STYLE}</style>
</head><body>
<header class="chrome">
  <p class="brand">The village</p>
  ${me ? `<p class="whoami">You are <strong>${esc(me.name)}</strong></p>` : ""}
</header>
<nav class="site" aria-label="site">
  <a href="/">Village map</a>
  <a href="/shelf">Memory shelf</a>
  <a href="/house/meeting">The meeting house</a>
  <a href="/leave">Leave the village</a>
</nav>
${inner}
</body></html>`;
}

const names = (list: string[]): string =>
  list.length === 0
    ? ""
    : list.length === 1
      ? esc(list[0])
      : list.slice(0, -1).map(esc).join(", ") + " and " + esc(list[list.length - 1]);

/** Two states, and the app says which one it is in. "In the room" is one
 *  person's record of something. "On the shelf" is a thing more than one
 *  person was there for. The app never collapses them. */
function stateLine(t: ThingView): string {
  if (!t.onShelf) {
    return `<span class="state" data-state="in-the-room">In the room</span>
      <span class="note">— nobody else was here when this was put down</span>`;
  }
  const n = t.keeperNames.length;
  return `<span class="state" data-state="on-the-shelf">On the shelf</span>
    <span class="note">— ${names(t.keeperNames)} ${n === 1 ? "was" : "were"} here too</span>`;
}

function thingItem(t: ThingView, houseSlug: string): string {
  let action: string;
  if (t.isOwn) {
    action = `<p class="note">You put this down, so you can't be the one who was here for it.</p>`;
  } else if (t.viewerHasKept) {
    action = `<p class="note">You were here for this.</p>`;
  } else {
    action = `<form method="post" action="/take">
      <input type="hidden" name="thing" value="${t.id}">
      <input type="hidden" name="house" value="${esc(houseSlug)}">
      <button>I was here for this</button></form>`;
  }
  return `<li class="thing">
    <p class="body">${esc(t.body)}</p>
    <p class="meta">${esc(t.placedByName)} · ${esc(t.createdAt)} UTC</p>
    <p>${stateLine(t)}</p>
    ${action}
  </li>`;
}

/** The who-line and the room list together, so the event stream can swap
 *  both in without reloading the page. An arrival publishes "arrived" and
 *  every other open session refetches this fragment — if the who-line lived
 *  outside it, the first thing two side-by-side sessions test (does the
 *  other person appear?) would show nothing until a full reload. Rendered
 *  by the same function either way, JavaScript on or off. */
export function roomFragment(otherNames: string[], things: ThingView[], houseSlug: string): string {
  const who = `<p class="lede" id="who">${otherNames.length ? names(otherNames) + (otherNames.length === 1 ? " was here in the last minute." : " were here in the last minute.") : "Nobody else has been here in the last minute."}</p>`;
  if (!things.length) {
    return `${who}<p class="empty">Nothing in this room yet. Put something down — it stays
      here either way, and goes on the shelf when somebody else is here for it.</p>`;
  }
  return `${who}<ol>${things.map((t) => thingItem(t, houseSlug)).join("")}</ol>`;
}

export function joinPage(houses: House[], message: string | null): string {
  const options = houses
    .map((h) => `<option value="${esc(h.slug)}">${esc(h.name)}</option>`)
    .join("");
  return page(
    "The village",
    `<main>
      <h1>The village</h1>
      <p class="lede">Four places and the people in them. Before you go in,
        say who you are — the app keeps a name and nothing else.</p>
      <p class="note">One browser is one person — the app knows you by a
        cookie, not a face. To be two of you, use a second browser or a
        private window, not a second tab.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/join">
        <label for="name">What should everyone call you?</label>
        <input id="name" name="name" required maxlength="40" placeholder="An">
        <label for="home">Which house is yours?</label>
        <select id="home" name="home" required>${options}</select>
        <button class="primary">Go in</button>
      </form>
    </main>`,
  );
}

/** A house's own tint for the CSS-drawn placeholder panel — terracotta for
 *  the ancestral house, sage for the brother's, amber for mine, and a deep
 *  ink wash for the shared one, so the four stay visually distinguishable
 *  without ever claiming to be a photograph. */
function tintFor(slug: string): string {
  switch (slug) {
    case "nghe-an": return "var(--hearth)";
    case "hanoi": return "var(--sage)";
    case "canberra": return "var(--amber)";
    default: return "var(--ink-soft)";
  }
}

function placeholderPanel(slug: string): string {
  return `<div class="placeholder" style="--tint:${tintFor(slug)}" aria-hidden="true"></div>
    <p class="placeholder-caption">A photograph of the real place belongs here.</p>`;
}

export function mapPage(
  houses: Array<House & { hereNames: string[] }>,
  me: Person,
  message: string | null,
): string {
  const cards = houses
    .map((h) => {
      const presence = h.hereNames.length
        ? names(h.hereNames) + (h.hereNames.length === 1 ? " is here" : " are here")
        : "Nobody is here";
      const home = h.slug === me.homeSlug ? `<span class="chip chip-home">Your house</span>` : "";
      return `<li class="house">
        <a class="house-card" href="/house/${esc(h.slug)}">
          <div class="card">
            <span class="eyebrow">${esc(h.kind === "meeting" ? "Shared common room" : "A family house")}</span>
            <h2>${esc(h.name)} ${home}</h2>
            ${placeholderPanel(h.slug)}
            <hr class="dashed-rule">
            <p class="here">${esc(presence)}</p>
          </div>
        </a>
      </li>`;
    })
    .join("");
  return page(
    "The village",
    `<main>
      <h1>The village</h1>
      <p class="lede">A thing you put down stays in the room you put it in.
        It goes on that house's shelf when somebody else was there for it —
        a memory is something two of you were there for.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <ul class="village">${cards}</ul>
      <p class="quiet">The map updates on its own as people arrive and leave.</p>
    </main>`,
    me,
  );
}

/** The real consequence of putting something down right now, built only from
 *  the presence names the route already computed — never invented. */
function consequenceLine(otherNames: string[]): string {
  if (!otherNames.length) {
    return "Nobody else is here. What you put down will stay in the room until someone comes.";
  }
  const verb = otherNames.length === 1 ? "is" : "are";
  const whose = otherNames.length === 1 ? "their name" : "their names";
  return `${names(otherNames)} ${verb} here right now. If ${otherNames.length === 1 ? "they are" : "they are"} still here, this goes on the shelf with ${whose}.`;
}

export function housePage(
  house: House,
  me: Person,
  /** Everyone else who has been here inside the TTL. The caller excludes the
   *  viewer by token before this is called — see the note in the route. */
  otherNames: string[],
  things: ThingView[],
  message: string | null,
): string {
  return page(
    house.name,
    `<main>
      <h1>${esc(house.name)}</h1>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <div class="layout-house">
        <div>
          ${placeholderPanel(house.slug)}
          <div id="room">${roomFragment(otherNames, things, house.slug)}</div>
        </div>
        <div class="panel-stack">
          <div class="card">
            <h3 class="rule-title">The two-state rule</h3>
            <p class="body-sm"><strong>In the room</strong> — nobody else was here yet.</p>
            <p class="body-sm"><strong>On the shelf</strong> — someone was here with you, and it stays.</p>
          </div>
          <div class="card-raised">
            <p class="consequence">${esc(consequenceLine(otherNames))}</p>
          </div>
          <form method="post" action="/place">
            <input type="hidden" name="house" value="${esc(house.slug)}">
            <label for="body">What do you want to put down here?</label>
            <input id="body" name="body" required maxlength="280" placeholder="He stood up on his own today">
            <button class="primary">Put this down</button>
          </form>
          <p class="quiet">No notifications, no alerts. You find out by visiting.</p>
        </div>
      </div>
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        const stream = new EventSource("/stream?house=" + encodeURIComponent(${JSON.stringify(house.slug)}));
        const resync = async () => {
          const res = await fetch("/house/" + encodeURIComponent(${JSON.stringify(house.slug)}) + "/room", { headers: { accept: "text/html" } });
          if (res.ok) room.innerHTML = await res.text();
        };
        stream.onmessage = resync;
        // EventSource reconnects on its own after the machine stops and
        // starts again (fly.toml lets it go to zero), but it only fires
        // onmessage on the NEXT event — whatever changed while the socket
        // was down would otherwise stay invisible until a full reload.
        stream.onopen = resync;
      </script>
    </main>`,
    me,
  );
}

export function shelfPage(
  houses: Array<House & { shelved: ThingView[] }>,
  me: Person,
  message: string | null,
): string {
  const sections = houses
    .map((h) => {
      const body = h.shelved.length
        ? `<ol>${h.shelved.map((t) => thingItem(t, h.slug)).join("")}</ol>`
        : `<p class="empty">Nothing from ${esc(h.name)} is on the shelf yet. Something
            gets here when two of you are in the room together.</p>`;
      return `<section><h2>${esc(h.name)}</h2>${body}</section>`;
    })
    .join("");
  return page(
    "The memory shelf",
    `<main>
      <h1>The memory shelf</h1>
      <p class="lede">Only the things more than one of you were there for. No
        compose box here — the shelf is for looking at.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      ${sections}
    </main>`,
    me,
  );
}

/** Minimal markdown, enough to publish README.md legibly. The spec only
 *  requires the headings to appear in order in the HTML the server sends. */
export function markdown(src: string): string {
  const inline = (s: string): string =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  const out: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let para: string[] = [];
  const flush = (): void => {
    if (list.length) { out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`); list = []; }
    if (quote.length) {
      const paras = quote.join("\n").split(/\n{2,}/).filter((p) => p.trim());
      out.push(
        `<blockquote>${paras.map((p) => `<p>${inline(p.replace(/\n/g, " "))}</p>`).join("")}</blockquote>`,
      );
      quote = [];
    }
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  let fenced = false;
  const code: string[] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trimEnd();
    if (/^ {0,3}(```|~~~)/.test(line)) {
      if (fenced) {
        out.push(`<pre><code>${code.join("\n")}</code></pre>`);
        code.length = 0;
      } else {
        flush();
      }
      fenced = !fenced;
      continue;
    }
    if (fenced) { code.push(esc(raw)); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^[-*]\s+(.*)$/.exec(line);
    const bq = /^ {0,3}>\s?(.*)$/.exec(line);
    // A wrapped list item's continuation line is indented but does not start
    // a new item or a heading — fold it onto the current item rather than
    // letting it fall through to the paragraph arm, which would cut the
    // bullet mid-sentence and orphan the rest below the </ul>.
    const cont = /^\s+(\S.*)$/.exec(raw.trimEnd());
    if (list.length && cont && !li && !h) { list[list.length - 1] += " " + cont[1]; continue; }
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (li) { list.push(li[1]); }
    else if (bq) { quote.push(bq[1]); }
    else if (!line.trim()) { flush(); }
    else { para.push(line); }
  }
  flush();
  // An unterminated fence at EOF still has to show what was captured rather
  // than swallow it.
  if (fenced && code.length) out.push(`<pre><code>${code.join("\n")}</code></pre>`);
  return out.join("\n");
}
