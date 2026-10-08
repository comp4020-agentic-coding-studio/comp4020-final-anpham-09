import { hasPicture, houseBySlug, type House } from "./houses.ts";
import { getPerson, type Person } from "./people.ts";
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

/* The village map: a parchment panel holding the grid, with a very faint
   dot texture (an existing-token radial-gradient, tiled) standing in for the
   reference's stippled paper. Decorative, so it lives on ::before and never
   competes with the text for contrast. */
.village-panel { position: relative; background: var(--card); border: 1px solid var(--rule);
  border-radius: 1.25rem; padding: 1.5rem; box-shadow: var(--shadow-1); overflow: hidden; }
.village-panel::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(color-mix(in srgb, var(--ink) 35%, transparent) 1px, transparent 1px);
  background-size: 16px 16px; opacity: .05; }
.village-panel > * { position: relative; }
.village-panel-foot { margin: 1.25rem 0 0; text-align: center; }
ul.village { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.25rem;
  grid-template-columns: repeat(2, 1fr); }
@media (max-width: 640px) { ul.village { grid-template-columns: 1fr; } }
li.house { list-style: none; display: flex; }
a.house-card { display: flex; min-height: 44px; width: 100%; text-decoration: none; color: inherit;
  border-radius: 1rem; }
a.house-card .card { display: flex; flex-direction: column; width: 100%;
  transition: box-shadow .15s ease, border-color .15s ease; }
a.house-card:hover .card, a.house-card:focus-visible .card {
  box-shadow: var(--shadow-2); border-color: color-mix(in srgb, var(--hearth) 45%, var(--rule)); }
a.house-card:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--hearth) 25%, transparent); }
a.house-card h2 { font-size: 1.5rem; line-height: 2rem; margin: 0 0 .75rem; }
/* The dashed rule sits right above the presence row; giving IT the auto
   margin (rather than the row) is what keeps the gap between them small
   while still pushing both down to a shared baseline across cards of
   different caption length. */
li.house hr.dashed-rule { margin-top: auto; }
.presence-row { display: flex; align-items: center; gap: .55rem; }
.presence-dot { width: .55rem; height: .55rem; min-width: .55rem; border-radius: 50%;
  background: var(--rule); }
.presence-dot[data-here="true"] { background: var(--sage); }
.presence-row .here { flex: 1; margin: 0; }
.enter-cta { font-weight: 600; font-size: .875rem; color: var(--hearth-deep); white-space: nowrap; }

/* The CSS-drawn placeholder panel — decorative, never a photograph. */
.placeholder { --tint: var(--hearth); aspect-ratio: 16 / 10; border-radius: 1rem; position: relative;
  overflow: hidden; box-shadow: inset 0 0 0 1px var(--rule);
  background-image:
    radial-gradient(ellipse at 75% 20%, color-mix(in srgb, var(--tint) 30%, transparent) 0%, transparent 55%),
    linear-gradient(135deg, color-mix(in srgb, var(--tint) 32%, var(--card)) 0%,
      color-mix(in srgb, var(--tint) 10%, var(--paper)) 55%, var(--card-raised) 100%); }
.placeholder-caption { font-style: italic; color: var(--ink-soft); font-size: .875rem; margin: .5rem 0 1rem; }

/* A real photograph, standing in the placeholder's place: same rounding and
   inset hairline, cropped to the same aspect ratio so the four different
   source ratios don't make four differently-shaped cards. */
.photo { display: block; width: 100%; height: 100%; aspect-ratio: 16 / 10; border-radius: 1rem;
  box-shadow: inset 0 0 0 1px var(--rule); object-fit: cover; }
/* The house page's own banner: wider and shallower than a map card, so a
   1000px-tall portrait source never turns into a column of photo pushing
   the room's actual content below the fold. */
.photo-banner, .placeholder.placeholder-banner { aspect-ratio: 21 / 9; }

/* Memory slips, alternately tilted as handwritten note slips. */
li.thing { list-style: none; background: var(--card); border: 1px solid var(--rule); border-radius: .75rem;
  box-shadow: var(--shadow-1); padding: 1rem 1.1rem; margin: 0 0 1rem; }
li.thing:nth-of-type(odd) { transform: rotate(-0.4deg); }
li.thing:nth-of-type(even) { transform: rotate(0.4deg); }
li.thing:has(.state[data-state="on-the-shelf"]) { border-left: 3px solid var(--sage); }
li.thing:has(.state[data-state="in-the-room"]) { border-left: 3px solid var(--amber); }
.body { font-size: 1.0625rem; margin: 0 0 .35rem; }
.meta { color: var(--ink-soft); font-size: .8125rem; margin: 0 0 .5rem; }

/* The house page's two-column layout: room content left, the putting-down
   panel right. On desktop the right panel travels with you; on mobile
   (below the same 768px break the grid itself collapses at) it simply
   stacks, unchanged. */
.layout-house { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; align-items: start; }
@media (max-width: 768px) { .layout-house { grid-template-columns: 1fr; } }
.panel-stack { display: grid; gap: 1.25rem; }
@media (min-width: 769px) { .panel-stack { position: sticky; top: 1.5rem; } }
.rule-title { margin: 0 0 .5rem; font-size: 1.125rem; }
.consequence { font-size: .9375rem; }

/* The meeting house's thread: a monogram (we have no photographs of
   people), the speaker's name, their home house as a chip, and a relative
   time, above the body and the unchanged two-state label. */
.monogram { display: inline-flex; align-items: center; justify-content: center;
  width: 2.25rem; height: 2.25rem; min-width: 2.25rem; border-radius: 50%;
  background: color-mix(in srgb, var(--sage) 22%, var(--card)); color: var(--sage-deep);
  font-family: var(--display); font-weight: 700; font-size: 1.0625rem; }
li.thread-msg { display: flex; gap: .75rem; align-items: flex-start; }
li.thread-msg .thread-body { flex: 1; min-width: 0; }
.thread-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
  margin: 0 0 .3rem; font-size: .9375rem; }
.thread-time { color: var(--ink-soft); font-size: .8125rem; }
/* Oldest at the top, newest at the bottom — a conversation reads downward,
   the opposite of the other rooms' most-recent-first list — and the thread
   scrolls on its own so the presence strip above it stays put. */
ol.thread { max-height: 32rem; overflow-y: auto; padding-right: .25rem; }
@media (prefers-reduced-motion: no-preference) { ol.thread { scroll-behavior: smooth; } }
/* A conversation's rows don't tilt like a loose memory slip — same source
   order as the tilt rules above, same specificity, so this simply wins. */
li.thread-msg:nth-of-type(odd), li.thread-msg:nth-of-type(even) { transform: none; }

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
function regularRoomFragment(otherNames: string[], things: ThingView[], houseSlug: string): string {
  const who = `<p class="lede" id="who">${otherNames.length ? names(otherNames) + (otherNames.length === 1 ? " was here in the last minute." : " were here in the last minute.") : "Nobody else has been here in the last minute."}</p>`;
  if (!things.length) {
    return `${who}<div class="card"><p class="empty">Nothing in this room yet. Put something down — it stays
      here either way, and goes on the shelf when somebody else is here for it.</p></div>`;
  }
  return `${who}<ol>${things.map((t) => thingItem(t, houseSlug)).join("")}</ol>`;
}

/** How long ago a thing was placed, in the register the rest of the app
 *  uses ("was here", never "saw"): a plain word for anything inside the
 *  last minute, minutes then hours, "yesterday" for exactly a day, days up
 *  to a week, and the absolute timestamp beyond that — never a guess dressed
 *  up as a fact. `created_at` is SQLite's `datetime('now')`: UTC with no
 *  timezone suffix, so it is parsed as UTC explicitly here, or every one of
 *  these would read hours off depending on the machine running the app. */
export function timeAgo(iso: string): string {
  const asUtc = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`;
  const then = new Date(asUtc).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${iso} UTC`;
}

/** A monogram standing in for an avatar — we have no photographs of the
 *  people in this village, so the first letter of their name is the whole
 *  of it, never a guessed picture. */
function monogram(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return `<span class="monogram" aria-hidden="true">${esc(letter)}</span>`;
}

/** The speaker's own house, as a chip — looked up from the real person
 *  record behind their placing token, never invented. A token with no
 *  person behind it (should not happen; placing requires joining first)
 *  simply carries no chip rather than a guessed one. */
function homeChip(placedByToken: string): string {
  const person = getPerson(placedByToken);
  const home = person ? houseBySlug(person.homeSlug) : undefined;
  return home ? `<span class="chip chip-home">${esc(home.name)}</span>` : "";
}

function threadMessage(t: ThingView, houseSlug: string): string {
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
  return `<li class="thing thread-msg">
    ${monogram(t.placedByName)}
    <div class="thread-body">
      <p class="thread-meta"><strong>${esc(t.placedByName)}</strong> ${homeChip(t.placedBy)}
        <span class="thread-time">${esc(timeAgo(t.createdAt))}</span></p>
      <p class="body">${esc(t.body)}</p>
      <p>${stateLine(t)}</p>
      ${action}
    </div>
  </li>`;
}

/** The meeting house alone renders as a conversation: oldest at the top,
 *  newest at the bottom (a conversation reads downward — the opposite of
 *  the other rooms' most-recent-first list), each row carrying a monogram,
 *  the speaker's own house, a relative time, and the same unchanged
 *  two-state label every other room shows. A presence strip about who else
 *  is actually around replaces the other rooms' who-line, in the same
 *  register ("nobody else", never "nobody" — the viewer is always here
 *  reading it). */
function threadFragment(otherNames: string[], things: ThingView[], houseSlug: string): string {
  const strip = `<p class="lede" id="who">${otherNames.length ? "Around the table right now: " + names(otherNames) + "." : "Nobody is at the table right now."}</p>`;
  if (!things.length) {
    return `${strip}<div class="card"><p class="empty">Nothing has been said at the table yet. Whatever you
      place there stays in the room either way, and goes on the shelf once somebody else is here for it.</p></div>`;
  }
  const oldestFirst = [...things].reverse();
  return `${strip}<ol class="thread">${oldestFirst.map((t) => threadMessage(t, houseSlug)).join("")}</ol>`;
}

/** The village's one room-list renderer, with the meeting house's single
 *  exception: it alone reads as a conversation (see `threadFragment`).
 *  Every other house keeps the plain room list this always rendered. */
export function roomFragment(otherNames: string[], things: ThingView[], houseSlug: string): string {
  return houseSlug === "meeting"
    ? threadFragment(otherNames, things, houseSlug)
    : regularRoomFragment(otherNames, things, houseSlug);
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

/** A true eyebrow for each house — who it actually belongs to, not a
 *  repeated "A FAMILY HOUSE" that tells a visitor nothing the house name
 *  didn't already say. Kept in one place so the map is the only caller. */
function eyebrowFor(slug: string): string {
  switch (slug) {
    case "nghe-an": return "My parents' house";
    case "hanoi": return "My brother's family";
    case "canberra": return "My house";
    default: return "Shared by everyone";
  }
}

function placeholderPanel(slug: string, variant: "card" | "banner" = "card"): string {
  const cls = variant === "banner" ? "placeholder placeholder-banner" : "placeholder";
  return `<div class="${cls}" style="--tint:${tintFor(slug)}" aria-hidden="true"></div>
    <p class="placeholder-caption">A photograph of the real place belongs here.</p>`;
}

/** These four pictures are stand-ins, not photographs of this family's actual
 *  houses — the real pixel dimensions are fixed here so the <img> never
 *  reflows while it loads, and the alt text describes what is actually in
 *  the frame, for someone who cannot see it. */
const PICTURES: Record<string, { width: number; height: number; alt: string }> = {
  "nghe-an": {
    width: 800,
    height: 470,
    alt: "A tiled courtyard house with its doors open and potted plants along the step.",
  },
  hanoi: {
    width: 1024,
    height: 683,
    alt: "A narrow balcony crowded with potted plants and small flags.",
  },
  canberra: {
    width: 1024,
    height: 683,
    alt: "A timber deck under eucalypts at dusk, with lanterns strung in a tree.",
  },
  meeting: {
    width: 1400,
    height: 875,
    alt: "A long timber hall with a central fireplace and rows of tables.",
  },
};

/** Reworded for a real picture that is still, honestly, a stand-in. Written
 *  once, here, rather than repeated per house. */
const STAND_IN_CAPTION = "A stand-in picture, until we take our own.";

/** The photograph if the house has one, falling back to the CSS-drawn
 *  placeholder when it does not — a house without a file still has to look
 *  deliberate, not broken. */
function photoPanel(slug: string, variant: "card" | "banner" = "card"): string {
  const pic = PICTURES[slug];
  if (!pic || !hasPicture(slug)) return placeholderPanel(slug, variant);
  const cls = variant === "banner" ? "photo photo-banner" : "photo";
  return `<img class="${cls}" src="/img/${slug}.jpg" width="${pic.width}" height="${pic.height}"
    loading="lazy" decoding="async" alt="${esc(pic.alt)}">
    <p class="placeholder-caption">${STAND_IN_CAPTION}</p>`;
}

export function mapPage(
  houses: Array<House & { hereNames: string[] }>,
  me: Person,
  message: string | null,
): string {
  const cards = houses
    .map((h) => {
      const isHere = h.hereNames.length > 0;
      const presence = isHere
        ? names(h.hereNames) + (h.hereNames.length === 1 ? " is here" : " are here")
        : "Nobody is here";
      const cta = isHere ? "Come on in →" : "Step inside →";
      const home = h.slug === me.homeSlug ? `<span class="chip chip-home">Your house</span>` : "";
      return `<li class="house">
        <a class="house-card" href="/house/${esc(h.slug)}">
          <div class="card">
            <span class="eyebrow">${esc(eyebrowFor(h.slug))}</span>
            <h2>${esc(h.name)} ${home}</h2>
            ${photoPanel(h.slug)}
            <hr class="dashed-rule">
            <p class="presence-row">
              <span class="presence-dot" data-here="${isHere}"></span>
              <span class="here">${esc(presence)}</span>
              <span class="enter-cta">${cta}</span>
            </p>
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
      <div class="village-panel">
        <ul class="village">${cards}</ul>
        <p class="quiet village-panel-foot">The map updates on its own as people arrive and leave.</p>
      </div>
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
  const isMeeting = house.slug === "meeting";
  const composeLabel = isMeeting ? "What do you want to say at the table?" : "What do you want to put down here?";
  const composeButton = isMeeting ? "Place words on the table" : "Put this down";
  const quietLine = isMeeting
    ? "Whatever is said here reaches everyone in the room. No alerts, no unread marks."
    : "No notifications, no alerts. You find out by visiting.";
  // The meeting house alone reads newest-at-the-bottom, so after every swap
  // of the room fragment — the initial render and every live resync — the
  // thread is scrolled to its newest message, the way a chat window would be.
  // Reduced motion is respected by the CSS (`scroll-behavior` is only set
  // under `prefers-reduced-motion: no-preference`), so this jumps rather
  // than animates for anyone who asked for that.
  const scrollScript = isMeeting
    ? `const scrollThreadToBottom = () => {
          const thread = room.querySelector("ol.thread");
          if (thread) thread.scrollTop = thread.scrollHeight;
        };
        scrollThreadToBottom();`
    : "";
  const resyncExtra = isMeeting ? "\n          scrollThreadToBottom();" : "";
  return page(
    house.name,
    `<main>
      <h1>${esc(house.name)}</h1>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <div class="layout-house">
        <div>
          ${photoPanel(house.slug, "banner")}
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
            <label for="body">${esc(composeLabel)}</label>
            <input id="body" name="body" required maxlength="280" placeholder="He stood up on his own today">
            <button class="primary">${esc(composeButton)}</button>
          </form>
          <p class="quiet">${esc(quietLine)}</p>
        </div>
      </div>
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        ${scrollScript}
        const stream = new EventSource("/stream?house=" + encodeURIComponent(${JSON.stringify(house.slug)}));
        const resync = async () => {
          const res = await fetch("/house/" + encodeURIComponent(${JSON.stringify(house.slug)}) + "/room", { headers: { accept: "text/html" } });
          if (res.ok) room.innerHTML = await res.text();${resyncExtra}
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
