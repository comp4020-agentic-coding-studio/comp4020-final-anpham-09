import type { GameView } from "./games.ts";
import { hasPicture, houseBySlug, type House } from "./houses.ts";
import { isQuanPit } from "./oanquan.ts";
import { getPerson, type Person } from "./people.ts";
import type { ThingView } from "./things.ts";

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fonts load over the network with `display=swap`; every fallback below is
 *  chosen for metric compatibility so a slow connection or a blocked CDN
 *  still lands on a readable page, not a layout-shifted or blank one. */
const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Caveat:wght@500;600&display=swap" rel="stylesheet">`;

const STYLE = `
/* Sampled off the Figma exports in assets/village-screens, not invented:
   the cream, the terracotta and the near-black brown are what the four
   screens are actually built from. --hand is for the one voice in the app
   that is a person's handwriting rather than the interface talking. */
:root {
  --paper:#FBF6ED; --card:#F3EDE4; --card-raised:#EDE4D6; --rule:#E2D5C3;
  /* The Figma's own secondary grey is #8A7A6E, which is 3.55:1 on a card —
     under AA for the body sizes it is used at (.note, .meta, every date on
     the shelf). Darkened to the same hue until it clears 4.5:1. The design
     is the brief, but an unreadable date is not what the design meant. */
  --ink:#381B13; --ink-soft:#6E5F54;
  /* Likewise the terracotta: white on #CB6041 is 3.97:1. Button labels are
     small and bold, not large text, so the fill darkens rather than the
     label lightening — there is nothing lighter than white. */
  --hearth:#CB6041; --hearth-deep:#9A3E23; --on-hearth:#FFFFFF;
  --hearth-fill:#B04E31;
  --sage:#647862; --sage-deep:#3E5343;
  --amber:#D9933B; --amber-deep:#8F5B19;
  --shadow-1:0 2px 8px -2px rgba(56,27,19,.05), 0 4px 16px -4px rgba(56,27,19,.06);
  --shadow-2:0 4px 12px -2px rgba(56,27,19,.08), 0 8px 24px -4px rgba(56,27,19,.08);
  /* Cards that float over a photograph need a heavier shadow than cards on
     paper, or they look pasted on rather than lying above the scene. */
  --shadow-float:0 2px 6px -1px rgba(30,16,10,.18), 0 12px 32px -8px rgba(30,16,10,.28);
  --display:"Libre Baskerville",Georgia,"Times New Roman",serif;
  --body:"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --hand:"Caveat","Segoe Script","Bradley Hand",cursive;
}
@media (prefers-color-scheme: dark) {
  :root {
    /* Warm ink-wood base, not grey. Terracotta is lifted (toward the
       reference's own --inverse-primary) rather than darkened, since a
       darkened terracotta on a dark ground reads muddy rather than warm. */
    --paper:#1A1512; --card:#241D19; --card-raised:#2E2520; --rule:#3E322B;
    --ink:#F2E7DF; --ink-soft:#BCA99E;
    --hearth:#E8927A; --hearth-deep:#FFB59F; --on-hearth:#2C2421;
    /* On a dark ground the fill is the lifted terracotta, not a darkened
       one: the label is dark ink, so the button needs to stay bright. */
    --hearth-fill:#E8927A;
    --sage:#A8C4AE; --sage-deep:#CBDCCF;
    --amber:#E8B877; --amber-deep:#FFD9A8;
    --shadow-1:0 2px 8px -2px rgba(0,0,0,.35), 0 4px 16px -4px rgba(0,0,0,.40);
    --shadow-2:0 4px 12px -2px rgba(0,0,0,.45), 0 8px 24px -4px rgba(0,0,0,.50);
    --shadow-float:0 2px 6px -1px rgba(0,0,0,.5), 0 12px 32px -8px rgba(0,0,0,.6);
  }
}
* { box-sizing: border-box; }
html { background: var(--paper); }
/* The width cap sits on main, not on body, because the village and the
   rooms are photographs you stand inside and have to reach both edges of
   the window. A page that wants the old measure asks for it by class;
   a page that wants the full window simply doesn't. */
body { margin: 0; padding: 0 0 4rem;
  font: 16px/1.5 var(--body); color: var(--ink); background: var(--paper); }
a { color: var(--hearth-deep); }
/* Not scoped to the main element: a page whose hero is full-bleed still
   wants its content measured, so this has to work on an inner block too. */
.measured { max-width: 72rem; margin-left: auto; margin-right: auto; padding: 0 1.25rem; }
@media (min-width: 768px) { .measured { padding: 0 2rem; } }

/* Chrome: brand, links and who-you-are on one cream bar, as in the Figma.
   It wraps to two rows under about 900px rather than collapsing behind a
   menu button — four links and a name is not enough to hide, and a disclosure
   widget would be the one piece of the interface that needs JavaScript. */
header.chrome { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem 2rem;
  padding: .85rem 1.25rem; background: var(--paper); border-bottom: 1px solid var(--rule); }
@media (min-width: 768px) { header.chrome { padding: .85rem 2rem; } }
.brand { font-family: var(--display); font-weight: 700; font-size: 1.375rem; color: var(--hearth);
  margin: 0; letter-spacing: -.01em; }
.whoami { display: flex; align-items: center; gap: .6rem; margin: 0 0 0 auto;
  font-size: .875rem; color: var(--ink-soft); }
.whoami strong { color: var(--ink); font-weight: 500; }
nav.site { display: flex; flex-wrap: wrap; align-items: center; gap: 0 1.75rem; }
nav.site a { display: inline-flex; align-items: center; min-height: 44px; padding: .2rem 0;
  font-weight: 500; font-size: .9375rem; color: var(--ink-soft); text-decoration: none;
  border-bottom: 2px solid transparent; }
nav.site a:hover { color: var(--hearth-deep); }
/* The page you are on is named, not merely tinted: aria-current carries it
   for a screen reader and the underline carries it for everyone else, so
   the state never rests on colour alone. */
nav.site a[aria-current="page"] { color: var(--hearth); border-bottom-color: var(--hearth); }
/* Leaving changes state (it clears presence and the cookie), so it is a form
   POST like every other action in the app, not a link — but it still has to
   sit in the nav row looking like the links beside it. */
nav.site form.leave { display: contents; }
nav.site form.leave button { all: unset; display: inline-flex; align-items: center; min-height: 44px;
  padding: .2rem 0; font-weight: 600; font-size: .9375rem; color: var(--ink-soft); cursor: pointer; }
nav.site form.leave button:hover { color: var(--hearth-deep); }

/* Libre Baskerville runs large for its point size and has a tall x-height,
   so the display sizes are a step smaller than the previous face wanted and
   the line heights are tighter. */
h1 { font-family: var(--display); font-weight: 700; font-size: 2.5rem; line-height: 1.15;
  letter-spacing: -0.02em; margin: 1.5rem 0 .5rem; color: var(--ink); }
h2 { font-family: var(--display); font-weight: 700; font-size: 1.75rem; line-height: 1.25;
  letter-spacing: -0.01em; margin: 2rem 0 .5rem; color: var(--ink); }
h3 { font-family: var(--display); font-weight: 700; font-size: 1.3125rem; line-height: 1.3;
  margin: 1.5rem 0 .5rem; color: var(--ink); }
@media (max-width: 640px) {
  h1 { font-size: 1.875rem; letter-spacing: -0.01em; }
  h2 { font-size: 1.4375rem; letter-spacing: 0; }
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
button.primary { background: var(--hearth-fill); color: var(--on-hearth); border: none;
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
.thing-title { font-family: var(--display); font-weight: 700; font-size: 1.0625rem; margin: 0 0 .25rem; color: var(--ink); }
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
   the opposite of the other rooms' most-recent-first list. The thread has
   no height limit of its own and no inner scrollbar: it grows with the page,
   the same way the reference's own conversation panel does. A fixed-height
   scroll box here used to clip the oldest message into a content-less sliver
   once the page auto-scrolled to the newest one — the page scrolling as a
   whole, handled in housePage's script, replaces that. */
/* A conversation's rows don't tilt like a loose memory slip — same source
   order as the tilt rules above, same specificity, so this simply wins. */
li.thread-msg:nth-of-type(odd), li.thread-msg:nth-of-type(even) { transform: none; }

/* The state label and its one small action share a line instead of the
   action being a loud full-width button under every message — the content
   is the loud part, not the housekeeping. Wraps below on narrow screens. */
.state-row { display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: .3rem .75rem; margin: 0 0 .5rem; }
.state-row .state-text { margin: 0; flex: 1 1 auto; min-width: 0; }
form.inline-take { display: inline-flex; margin: .5rem 0 0; flex: 0 0 auto; }
form.inline-take button { min-height: 44px; padding: .4rem .85rem; font-size: .8125rem; }

/* A thing's perspectives: each person's own words on it, appended below the
   original body — never replacing it. */
ol.perspectives { display: grid; gap: .5rem; margin: .5rem 0; padding-left: .75rem;
  border-left: 2px solid var(--rule); }
li.perspective { list-style: none; }
li.perspective .body { font-size: .9375rem; margin: 0 0 .15rem; }
li.perspective .meta { margin: 0; }

/* The one small action still open on a thing — adding a perspective, or
   (once the viewer has one) keeping it together — as a compact inline form
   rather than a full-width one, same register as the rest of a memory slip. */
form.inline-perspective { display: flex; flex-wrap: wrap; align-items: center;
  gap: .4rem; margin: .5rem 0 0; }
/* A label that a screen reader reads and the eye doesn't: used where the
   placeholder and the surrounding context already say what the field is,
   but the field still needs a real label to be announced at all. */
.visually-hidden, form.inline-perspective label { position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
form.inline-perspective input { flex: 1 1 12rem; min-height: 40px; padding: .45rem .7rem;
  font-size: .875rem; }
form.inline-perspective button { min-height: 40px; padding: .4rem .85rem; font-size: .8125rem; flex: 0 0 auto; }

/* The Shelf's house/year/keyword filters, as one GET form so every result is
   a plain bookmarkable/shareable URL — no client-side state to get out of
   sync with what the database actually holds. */
form.shelf-filters { display: flex; flex-wrap: wrap; align-items: end; gap: .6rem; }
form.shelf-filters label { font-size: .8125rem; }
form.shelf-filters > div, form.shelf-filters label { display: block; }
form.shelf-filters select, form.shelf-filters input { min-height: 40px; padding: .45rem .7rem; font-size: .875rem; }
form.shelf-filters button { min-height: 40px; padding: .4rem .9rem; font-size: .8125rem; }
form.shelf-filters a { align-self: center; font-size: .875rem; }

blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid var(--rule); color: var(--ink-soft); }
blockquote p { margin: .4rem 0; }
main :is(h2,h3) { margin-top: 2rem; }

/* ---- Scenes ----------------------------------------------------------
   A scene is a photograph you stand inside: the village from the path, or a
   room from the doorway. The picture is an <img>, not a background-image,
   so it can carry srcset and be told which width to fetch — a 3MB hero on a
   phone is the failure the course's own "slow connection" band looks for.
   Everything else in the scene floats above it.

   The scrim is what makes text on top of a photograph legible. It is darkest
   where the type sits and clears towards the middle, so the room is still
   visibly a room. */
/* Stacking runs forwards, not behind: the photo is z-index 0, the scrim 1,
   the copy 2. Negative z-indexes would put the photograph behind the page's
   own background and paint it out entirely. */
.scene { position: relative; isolation: isolate; overflow: hidden; }
.scene-photo { position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; z-index: 0; }
.scene::after { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    linear-gradient(to bottom, rgba(30,16,10,.52) 0%, rgba(30,16,10,.12) 42%, rgba(30,16,10,.10) 58%, rgba(30,16,10,.58) 100%); }
/* A room's copy sits in the top-left corner over whatever furniture happens
   to be there — in Nghe An, a sunlit window. The village's copy is centred
   over sky and needs no such help, so this is the room scrim only: a soft
   wash from the left, under the heading, clearing before mid-frame. */
.scene-room::before { content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(105deg, rgba(30,16,10,.62) 0%, rgba(30,16,10,.42) 28%, rgba(30,16,10,0) 62%); }
/* Scene type is white on a photograph, so it carries its own shadow rather
   than relying on the scrim alone — the sky behind the village heading is
   nearly as light as the text. */
.scene-copy { position: relative; z-index: 2; color: #FFF8EF;
  text-shadow: 0 1px 2px rgba(30,16,10,.5), 0 2px 18px rgba(30,16,10,.35); }
.scene-copy :is(h1, h2) { color: inherit; }
.scene-copy .lede { color: #FBEDDF; }
.scene-eyebrow { display: block; font-size: .8125rem; font-weight: 500; letter-spacing: .14em;
  text-transform: uppercase; color: #F2DFCC; margin: 0 0 .75rem; }

/* The village scene is tall and centred; a room scene is shallower, since a
   room has content stacked underneath it. Both are capped in vh so a short
   laptop window never has to scroll past the picture to reach the app. */
/* The village fills what's left of the window under the chrome, so you
   arrive standing in the place rather than looking at a band of it. Capped
   so a very tall window doesn't stretch the photograph past its crop. */
.scene-village { min-height: min(calc(100vh - 3.75rem), 46rem); display: grid; align-content: start;
  padding: 3.5rem 1.25rem 2.5rem; text-align: center; }
.scene-room { min-height: min(52vh, 28rem); display: grid; align-content: start;
  padding: 2rem 1.25rem 2.5rem; }
@media (min-width: 768px) {
  .scene-village { padding: 4.5rem 2rem 3rem; }
  .scene-room { padding: 2.25rem 2rem 3rem; }
}
.scene-inner { width: 100%; max-width: 72rem; margin: 0 auto; }
.scene-village h1 { font-size: clamp(2.75rem, 7vw, 4.5rem); margin: 0 0 .5rem; }
.scene-village .lede { max-width: 34rem; margin: 0 auto .75rem; font-size: 1.25rem; }
/* The rule, in small type, over the brightest part of the photograph — the
   sunset sky is very nearly the colour of the text. A text-shadow alone
   can't carry it, so the sentence gets its own soft panel. */
.scene-village .scene-sub { max-width: 34rem; margin: 0 auto; font-size: .9375rem;
  color: #FBF1E6; text-shadow: none; padding: .7rem 1.1rem; border-radius: .75rem;
  background: rgba(40,22,14,.42);
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
.scene-room h1 { font-size: clamp(2.25rem, 5.5vw, 3.5rem); margin: .35rem 0 .35rem; }
.scene-room .lede { max-width: 26rem; font-size: 1.0625rem; }
/* Who is in the room, under the room's name: the discs and the same fact
   in words. */
.scene-presence { display: flex; align-items: center; gap: .6rem; margin: .9rem 0 0;
  font-size: .9375rem; color: #FBF0E4; }
.scene-presence .face { box-shadow: 0 0 0 2px rgba(40,22,14,.35); }
/* A room with no photograph at all: its own tint rather than a broken
   image. The copy on top is unchanged, so it stays legible either way. */
.scene-untinted { --tint: var(--hearth);
  background-image: linear-gradient(135deg,
    color-mix(in srgb, var(--tint) 55%, #2A1710) 0%,
    color-mix(in srgb, var(--tint) 25%, #2A1710) 100%); }
/* The room's content sits under its scene, not beside a banner. */
.layout-house { margin-top: 2rem; }
/* Back out of a room, in the scene's own white rather than the link colour,
   which is tuned for cream and disappears on a photograph. */
.scene-back { display: inline-flex; align-items: center; gap: .4rem; min-height: 44px;
  color: #F6E7D8; font-size: .9375rem; text-decoration: none; }
.scene-back:hover { color: #FFFFFF; text-decoration: underline; }

/* ---- Floating cards --------------------------------------------------
   The Figma's signature: small cream cards lying on top of the scene, each
   naming a house and who is in it. On a phone they stop floating and become
   an ordinary stacked list under the heading — absolute positioning over a
   photograph has nowhere to go at 380px wide. */
/* Below 900px this is a plain stacked list under the heading, and it carries
   the scene's own side padding because it is no longer inside the copy
   column that was providing it. */
.scene-cards { position: relative; z-index: 2; list-style: none; margin: 2rem 0 0;
  padding: 0 1.25rem; display: grid; gap: .75rem; }
.float-card { display: flex; align-items: center; gap: .85rem; width: 100%;
  padding: .7rem .85rem; text-align: left; text-decoration: none; color: var(--ink);
  background: var(--paper); border: 1px solid transparent; border-radius: .9rem;
  box-shadow: var(--shadow-float); }
.float-card:hover, .float-card:focus-visible { border-color: color-mix(in srgb, var(--hearth) 45%, transparent); }
.float-card:focus-visible { outline: none;
  box-shadow: var(--shadow-float), 0 0 0 3px color-mix(in srgb, var(--hearth) 35%, transparent); }
.float-card .float-name { font-family: var(--display); font-weight: 700; font-size: 1.0625rem;
  margin: 0; color: var(--ink); }
.float-card .float-meta { margin: .15rem 0 0; font-size: .8125rem; color: var(--ink-soft); }
.float-card .float-text { min-width: 0; display: block; }
.float-card .float-name, .float-card .float-meta { display: block; }
.float-card .float-go { margin-left: auto; display: inline-flex; align-items: center;
  justify-content: center; width: 1.9rem; height: 1.9rem; min-width: 1.9rem; border-radius: 50%;
  background: var(--sage); color: var(--on-hearth); font-size: .9rem; }
.float-card[data-kind="meeting"] .float-go { background: var(--hearth); }

/* A refusal or confirmation on top of a photograph needs its own ground;
   the scrim is not enough to make small text reliably readable. */
.scene-notice { display: inline-block; margin: 1rem 0 0; padding: .55rem .9rem;
  background: var(--paper); color: var(--ink); border-radius: .6rem;
  box-shadow: var(--shadow-float); font-size: .9375rem; text-shadow: none; }

/* The note on the stone in the Figma. It is an instruction, so it is only
   worth its space while the cards are floating and their affordance is less
   obvious; stacked on a phone they are plainly a list of links. */
.scene-hint { display: none; }
@media (min-width: 900px) {
  .scene-hint { display: block; position: absolute; left: 50%; bottom: 5%; z-index: 2;
    transform: translateX(-50%) rotate(-3deg); margin: 0; text-align: center;
    font-size: 1.625rem; text-shadow: 0 1px 10px rgba(30,16,10,.75), 0 1px 2px rgba(30,16,10,.6); }
}
.village-foot { text-align: center; margin: 1.5rem auto 0; }

/* Above 900px the cards scatter across the scene the way they do in the
   Figma, each one roughly over its own house. The list spans the whole
   scene rather than sitting inside the centred copy column, so the
   percentages below are percentages of the picture, which is what they
   are describing. Below 900px it is an ordinary stacked list and the
   positioning never applies. */
@media (min-width: 900px) {
  .scene-cards { position: absolute; inset: 0; z-index: 2; display: block;
    margin: 0; pointer-events: none; }
  .scene-cards li { position: absolute; width: 15.5rem; pointer-events: auto; }
  .scene-cards li:nth-child(1) { left: 4%;  top: 46%; }
  .scene-cards li:nth-child(2) { left: 30%; top: 56%; }
  .scene-cards li:nth-child(3) { left: 54%; top: 62%; }
  .scene-cards li:nth-child(4) { right: 4%; top: 44%; }
}

/* ---- People ----------------------------------------------------------
   We hold a chosen name and nothing else, so a face is drawn from the name:
   its initial on a tinted disc. Overlapped into a row, they read as "who is
   here" at a glance, and the names are still written out beside them for
   anyone who can't see the discs. */
.faces { display: inline-flex; align-items: center; flex-direction: row-reverse; }
.faces .face { margin-left: -.5rem; box-shadow: 0 0 0 2px var(--paper); }
.faces .face:last-child { margin-left: 0; }
.face { display: inline-flex; align-items: center; justify-content: center;
  width: 1.75rem; height: 1.75rem; min-width: 1.75rem; border-radius: 50%;
  font-family: var(--display); font-weight: 700; font-size: .8125rem; line-height: 1;
  background: color-mix(in srgb, var(--sage) 24%, var(--card)); color: var(--sage-deep); }
.face-lg { width: 2.25rem; height: 2.25rem; min-width: 2.25rem; font-size: 1rem; }
/* Four tints so a row of faces is readable as several people rather than
   one repeated disc. Assigned from the name, so a person keeps theirs. */
.face[data-tint="1"] { background: color-mix(in srgb, var(--hearth) 22%, var(--card)); color: var(--hearth-deep); }
.face[data-tint="2"] { background: color-mix(in srgb, var(--amber) 26%, var(--card)); color: var(--amber-deep); }
.face[data-tint="3"] { background: color-mix(in srgb, var(--sage) 30%, var(--card)); color: var(--sage-deep); }

/* ---- Handwriting -----------------------------------------------------
   Caveat is the family's voice, never the interface's: a note on the path,
   a pull-quote on the shelf. Controls, labels and refusals stay in DM Sans,
   because a system message pretending to be handwritten is a lie about who
   is speaking. */
.hand { font-family: var(--hand); font-size: 1.5rem; line-height: 1.35; color: var(--ink); }
.scene .hand { color: #FFF4E6; }

/* The meeting house's composer: one row, because it is one field. The
   household houses keep the stacked title/body/date form, which is a
   different kind of writing and deserves the room. */
form.say { display: flex; align-items: center; gap: .5rem; margin: 1.25rem 0; }
form.say input { flex: 1 1 auto; min-width: 0; }
form.say button { flex: 0 0 auto; }

/* ---- The table ------------------------------------------------------- */
.table-area { display: grid; gap: 1.5rem; margin-top: 2rem; align-items: start; }
@media (min-width: 900px) { .table-area { grid-template-columns: 1fr 19rem; } }
.board-status { margin: 0 0 .9rem; font-size: 1.0625rem; color: var(--ink); }

/* The board is a ring of twelve, drawn as two rows between two half-round
   ends. It scrolls sideways rather than shrinking below legibility: five
   pits plus two quan in 360px would be 40px cells, under the 44px floor. */
.board-wrap { overflow-x: auto; padding-bottom: .25rem; }
.board { display: flex; align-items: stretch; gap: .4rem; min-width: 34rem;
  padding: .6rem; background: var(--card); border: 1px solid var(--rule);
  border-radius: 6rem / 4rem; box-shadow: var(--shadow-1); }
.board-rows { flex: 1; display: grid; gap: .4rem; }
ul.pit-row { list-style: none; margin: 0; padding: 0; display: grid;
  grid-template-columns: repeat(5, 1fr); gap: .4rem; }
.pit { position: relative; display: flex; align-items: center; justify-content: center;
  min-height: 4.25rem; border-radius: .6rem; background: var(--card-raised);
  box-shadow: inset 0 0 0 1px var(--rule); }
.pit-count { font-family: var(--display); font-weight: 700; font-size: 1.0625rem;
  color: var(--ink-soft); }
/* A pit holding a quan is the terracotta disc from the Figma. */
.quan-end { display: flex; align-items: center; }
.quan-end .pit { width: 4.5rem; min-height: 100%; border-radius: 4rem / 6rem; }
.pit-quan .pit-count { color: var(--on-hearth); }
.pit-quan { background: var(--hearth-fill); box-shadow: none; }
/* An emptied quan pit is no longer special, and says so by losing the fill
   rather than by keeping a colour that would claim a quan is still there. */
.pit-quan[data-stones="0"] { background: var(--card-raised); box-shadow: inset 0 0 0 1px var(--rule); }
.pit-quan[data-stones="0"] .pit-count { color: var(--ink-soft); }

/* A pit you can pick up is a link, and looks like a control. A pit you
   cannot is not a control at all — no disabled button to click at. */
a.pit-pick { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; border-radius: .6rem; text-decoration: none;
  background: var(--paper); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sage) 45%, transparent); }
a.pit-pick .pit-count { color: var(--ink); }
a.pit-pick:hover { box-shadow: inset 0 0 0 2px var(--hearth); }
a.pit-pick:focus-visible { outline: none;
  box-shadow: inset 0 0 0 2px var(--hearth), 0 0 0 3px color-mix(in srgb, var(--hearth) 30%, transparent); }
/* The picked pit, marked by weight and a ring rather than by colour alone —
   and the aria-current attribute carries the same fact for a screen
   reader. */
a.pit-pick[aria-current] { background: var(--paper);
  box-shadow: inset 0 0 0 3px var(--hearth), var(--shadow-2); }
a.pit-pick[aria-current] .pit-count { color: var(--hearth-deep); }

.board-side-label { margin: .35rem 0; font-size: .8125rem; letter-spacing: .04em;
  text-transform: uppercase; color: var(--ink-soft); text-align: center; }
form.sow { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; margin: 1rem 0 0; }
form.sow .cancel { font-size: .875rem; }

ul.chairs { list-style: none; margin: .75rem 0; padding: 0; display: grid; gap: .5rem; }
li.chair { display: flex; align-items: center; gap: .6rem; padding: .5rem .6rem;
  background: var(--card-raised); border-radius: .6rem; }
li.chair .chair-name { flex: 1; min-width: 0; font-size: .9375rem; }
li.chair .chair-score { font-family: var(--display); font-weight: 700; font-size: 1.125rem; }
li.chair-empty { background: transparent; box-shadow: inset 0 0 0 1px dashed var(--rule); }
li.chair-empty .chair-name { color: var(--ink-soft); font-style: italic; }
li.chair form { margin: 0; }

/* The rules, as a disclosure: no script, keyboard-operable, and open by
   default for nobody — it is reference, not an interruption. */
details.rules { margin: 1.25rem 0 0; }
details.rules > summary { display: flex; align-items: center; min-height: 44px;
  cursor: pointer; font-weight: 500; color: var(--hearth-deep); }
.rules-body { padding: .5rem 0 0; }
.rules-body .rule { margin: 0 0 .75rem; }
.rules-body h4 { font-family: var(--display); font-size: .9375rem; margin: 0 0 .15rem; }
.rules-body p { font-size: .9375rem; margin: 0; color: var(--ink-soft); }
@media (min-width: 640px) {
  .rules-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1.5rem; }
  .rules-body > .lede, .rules-body > .quiet { grid-column: 1 / -1; }
}

/* ---- The shelf ------------------------------------------------------- */
.shelf-head { display: flex; flex-wrap: wrap; align-items: flex-start;
  justify-content: space-between; gap: 1rem 2rem; margin-top: 1.5rem; }
.shelf-head-copy { max-width: 42rem; }
.shelf-head h1 { margin-top: 0; }
/* The family's own voice, once, at the top — the only handwriting on a page
   that is otherwise all interface. */
.shelf-aside { margin: .75rem 0 0; color: var(--ink-soft); transform: rotate(-2deg); }
.shelf-count { margin: 1rem 0 1.25rem; }

/* A wall of cards rather than a list per house: the shelf's claim is that
   this is one family's memory, not four collections. Columns rather than a
   grid so cards keep their own height — a memory with three perspectives on
   it is genuinely taller than one with none, and stretching them all to a
   row's tallest would be a lie about how much is there. */
ol.wall { columns: 3 18rem; column-gap: 1.25rem; padding: 0; margin: 0; }
@media (max-width: 640px) { ol.wall { columns: 1; } }
li.card-shelf { break-inside: avoid; display: block; margin: 0 0 1.25rem;
  padding: 0; overflow: hidden; background: var(--card); border: 1px solid var(--rule);
  border-left: 1px solid var(--rule); border-radius: .9rem; box-shadow: var(--shadow-1); }
/* The wall's cards don't tilt — a tilted slip reads as loose paper in a
   room, which is right there and wrong here, where the point is that these
   are settled. Same specificity as the tilt rules, declared after them. */
li.card-shelf:nth-of-type(odd), li.card-shelf:nth-of-type(even) { transform: none; }
.card-shelf-body { padding: 1.1rem 1.15rem .35rem; }
.card-shelf-body .thing-title { margin-top: 0; font-size: 1.125rem; }
.card-shelf-foot { padding: .6rem 1.15rem 1rem; }
.card-shelf-where { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0 0 .5rem; }
/* Who kept it, with the faces: the two names are the product, so they are
   the last thing on the card and they are not small. */
.card-shelf-who { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin: 0; }
.card-shelf-who .state { font-weight: 500; }
/* Each house gets its own chip tint, matching the map's four. */
.chip-house { background: color-mix(in srgb, var(--hearth) 16%, var(--card)); color: var(--hearth-deep); }
.chip-house[data-house="hanoi"] { background: color-mix(in srgb, var(--sage) 20%, var(--card)); color: var(--sage-deep); }
.chip-house[data-house="canberra"] { background: color-mix(in srgb, var(--amber) 24%, var(--card)); color: var(--amber-deep); }
.chip-house[data-house="meeting"] { background: color-mix(in srgb, var(--ink) 10%, var(--card)); color: var(--ink); }

@media (prefers-reduced-motion: no-preference) {
  a.house-card { transition: transform .15s ease; }
  a.house-card:hover { transform: translateY(-2px); }
  .float-card { transition: transform .15s ease, border-color .15s ease; }
  .float-card:hover { transform: translateY(-2px); }
}
`;

/** Which nav link is the page you are on, so it can be marked. Pages that
 *  aren't one of the three (the README, a household room) pass nothing and
 *  no link is marked, which is honest — none of them is where you are. */
export type NavKey = "map" | "shelf" | "meeting";

export function page(
  title: string,
  inner: string,
  me?: Person | null,
  active?: NavKey,
): string {
  const link = (href: string, key: NavKey, label: string): string =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${FONTS_HEAD}
<title>${esc(title)}</title><style>${STYLE}</style>
</head><body>
<header class="chrome">
  <p class="brand">The village</p>
  <nav class="site" aria-label="site">
    ${link("/", "map", "Village map")}
    ${link("/shelf", "shelf", "Memory shelf")}
    ${link("/house/meeting", "meeting", "The meeting house")}
    <form class="leave" method="post" action="/leave"><button type="submit">Leave the village</button></form>
  </nav>
  ${
    me
      ? `<p class="whoami">You are <strong>${esc(me.name)}</strong> ${face(me.name)}</p>`
      : ""
  }
</header>
${inner}
</body></html>`;
}

/** A person as a disc with their initial. We hold a chosen name and nothing
 *  else — no uploads, no accounts — so the face is derived from the name
 *  rather than stored. The tint is derived too, so a person keeps the same
 *  one everywhere without anything being written down about them.
 *  `aria-hidden` because every face in this app sits beside the name it was
 *  made from: read aloud, it would just say the name twice. */
function face(name: string, size: "sm" | "lg" = "sm"): string {
  const initial = [...name.trim()][0] ?? "?";
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 4;
  return `<span class="face${size === "lg" ? " face-lg" : ""}" data-tint="${hash}" aria-hidden="true">${esc(initial.toUpperCase())}</span>`;
}

/** A row of faces for the people in a room, newest-overlapping-oldest. Caps
 *  at four discs and counts the rest, since five overlapping discs stop
 *  being legible as people. Always paired with the names in text. */
function faces(list: string[]): string {
  if (list.length === 0) return "";
  const shown = list.slice(0, 4);
  const rest = list.length - shown.length;
  // Reversed in the markup because the row is laid out row-reverse, which
  // is what makes the first person overlap on top rather than underneath.
  const discs = [...shown].reverse().map((n) => face(n)).join("");
  const more = rest > 0 ? `<span class="face" aria-hidden="true">+${rest}</span>` : "";
  return `<span class="faces">${more}${discs}</span>`;
}

const names = (list: string[]): string =>
  list.length === 0
    ? ""
    : list.length === 1
      ? esc(list[0])
      : list.slice(0, -1).map(esc).join(", ") + " and " + esc(list[list.length - 1]);

/** Two states, and the app says which one it is in. "In the room" is one
 *  person's record of something. "On the shelf" is a thing more than one
 *  person was there for, kept together on purpose. The app never collapses
 *  them, and never implies presence alone is what moved it — see
 *  `consequenceLine` for the same rule applied to what happens next. */
function stateLine(t: ThingView): string {
  if (!t.onShelf) {
    return `<span class="state" data-state="in-the-room">In the room</span>
      <span class="note">— nobody has kept this together yet</span>`;
  }
  return `<span class="state" data-state="on-the-shelf">On the shelf</span>
    <span class="note">— Kept together by ${esc(t.placedByName)} &amp; ${names(t.keeperNames)}</span>`;
}

/** A thing's own perspectives, oldest first — append-only, so this is the
 *  only place any of them are read back. Empty when nobody but the placer
 *  has written one yet; the placer's own body already carries their side. */
function perspectivesList(t: ThingView): string {
  if (!t.perspectives.length) return "";
  const items = t.perspectives
    .map((p) => `<li class="perspective"><p class="body">${esc(p.body)}</p>
      <p class="meta">${esc(p.authorName)} · ${esc(timeAgo(p.createdAt))}</p></li>`)
    .join("");
  return `<ol class="perspectives">${items}</ol>`;
}

/** The two actions a thing can still offer, each gated on what the viewer has
 *  already done — never both at once, and never the placer's own thing.
 *  Writing a perspective is the precondition prompt.md requires for keeping
 *  something together, so the form that matters is the one the viewer is
 *  actually eligible for right now. */
function perspectiveForm(t: ThingView, houseSlug: string): string {
  return `<form method="post" action="/perspectives" class="inline-perspective">
    <input type="hidden" name="thing" value="${t.id}">
    <input type="hidden" name="house" value="${esc(houseSlug)}">
    <label for="perspective-${t.id}">Add your perspective</label>
    <input id="perspective-${t.id}" name="body" required maxlength="280" placeholder="What I remember about this">
    <button>Add your perspective</button></form>`;
}

function keepForm(t: ThingView, houseSlug: string): string {
  return `<form method="post" action="/take" class="inline-take">
    <input type="hidden" name="thing" value="${t.id}">
    <input type="hidden" name="house" value="${esc(houseSlug)}">
    <button>Keep this together</button></form>`;
}

function actionArea(t: ThingView, houseSlug: string): string {
  if (t.isOwn) return `<p class="note">You put this down, so you can't be the one who keeps it together too.</p>`;
  if (t.viewerHasKept) return `<p class="note">You kept this together.</p>`;
  if (t.viewerHasPerspective) return keepForm(t, houseSlug);
  return perspectiveForm(t, houseSlug);
}

/** The state label alone, on its own line — see `.state-row`. Shared by the
 *  ordinary room list and the meeting house's thread, since both show the
 *  same two-state rule on the same kind of row. */
function stateRow(t: ThingView): string {
  return `<div class="state-row"><p class="state-text">${stateLine(t)}</p></div>`;
}

function dateMeta(t: ThingView): string {
  const bits = [`${esc(t.placedByName)} · ${esc(timeAgo(t.createdAt))}`];
  if (t.eventDate) bits.push(`about ${esc(t.eventDate)}`);
  if (t.onShelf && t.keptAt) bits.push(`kept ${esc(timeAgo(t.keptAt))}`);
  return `<p class="meta">${bits.join(" · ")}</p>`;
}

function thingItem(t: ThingView, houseSlug: string): string {
  return `<li class="thing">
    ${titleLine(t)}
    <p class="body">${esc(t.body)}</p>
    ${dateMeta(t)}
    ${stateRow(t)}
    ${perspectivesList(t)}
    ${actionArea(t, houseSlug)}
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

/** A thing's title, or nothing at all when it hasn't got one. Two kinds of
 *  thing have no title: a line said at the table, which never had one, and
 *  anything placed before the app asked for titles. Rendering an empty
 *  element for either leaves a gap on the page and announces a heading with
 *  no words in it. */
function titleLine(t: ThingView, tag: "p" | "h3" = "p"): string {
  return t.title.trim()
    ? `<${tag} class="thing-title">${esc(t.title)}</${tag}>`
    : "";
}

/** The event date and (once shelved) kept date alone — the thread already
 *  shows who and when-posted in `.thread-meta`, so this only adds what that
 *  line doesn't carry. */
function eventAndKeptMeta(t: ThingView): string {
  const bits: string[] = [];
  if (t.eventDate) bits.push(`about ${esc(t.eventDate)}`);
  if (t.onShelf && t.keptAt) bits.push(`kept ${esc(timeAgo(t.keptAt))}`);
  return bits.length ? `<p class="meta">${bits.join(" · ")}</p>` : "";
}

function threadMessage(t: ThingView, houseSlug: string): string {
  return `<li class="thing thread-msg">
    ${monogram(t.placedByName)}
    <div class="thread-body">
      <p class="thread-meta"><strong>${esc(t.placedByName)}</strong> ${homeChip(t.placedBy)}
        <span class="thread-time">${esc(timeAgo(t.createdAt))}</span></p>
      ${titleLine(t)}
      <p class="body">${esc(t.body)}</p>
      ${eventAndKeptMeta(t)}
      ${stateRow(t)}
      ${perspectivesList(t)}
      ${actionArea(t, houseSlug)}
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
    `<main class="measured">
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

/** The full-bleed photographs the village and two of the rooms are built on.
 *  Three widths each: a phone fetches a third of what a laptop does, which
 *  is the whole reason these exist as WebP rather than the 3MB source PNGs.
 *  `scripts/build-images.sh` writes them; this table names them. */
const SCENES: Record<string, { alt: string }> = {
  village: {
    alt: "Four houses around a stone path at sunset, lanterns lit, hills behind.",
  },
  "room-nghe-an": {
    alt: "A long wooden dining table by open shutters, flowers in a jug, bookcases along the wall.",
  },
  "room-meeting": {
    alt: "A timber hall with a lit fireplace, a long table laid out, and mountains through the windows.",
  },
};

/** A photograph you stand inside. The picture is an element rather than a
 *  CSS background so it can carry `srcset` and be told what width to fetch;
 *  `sizes=100vw` because every scene is full-bleed. It is `aria-hidden` and
 *  alt-empty when the copy above it already says where you are — a room's
 *  own heading names the room better than a description of the furniture.
 *
 *  Scenes are the one place the app loads an image eagerly: it is the first
 *  thing on the page, and lazy-loading the thing at the top of the viewport
 *  only delays it. */
/** Which houses have a room photograph to stand inside. Nghe An and the
 *  meeting house do; Hanoi and Canberra fall back to their existing house
 *  picture as the scene, which is a narrower crop but the same idea. The
 *  day someone supplies real room photographs for those two, they get an
 *  entry here and `scripts/build-images.sh` does the rest. */
const ROOM_SCENES: Record<string, string> = {
  "nghe-an": "room-nghe-an",
  meeting: "room-meeting",
};

/** A room as a scene. Houses with a Figma room photograph get the three
 *  WebP widths; the other two get their single house JPEG, which carries
 *  no srcset because there is only the one file. */
function roomScene(slug: string, inner: string, over = ""): string {
  const named = ROOM_SCENES[slug];
  if (named) return scene(named, "room", inner, over);
  const pic = PICTURES[slug];
  if (!pic || !hasPicture(slug)) {
    // No picture at all: the scene degrades to a tinted band rather than a
    // broken image, and the copy on top is unchanged.
    return `<div class="scene scene-room scene-untinted" style="--tint:${tintFor(slug)}">
      <div class="scene-inner scene-copy">${inner}</div>
      ${over}
    </div>`;
  }
  return `<div class="scene scene-room">
    <img class="scene-photo" src="/img/${esc(slug)}.jpg" width="${pic.width}" height="${pic.height}"
      decoding="async" alt="${esc(pic.alt)}">
    <div class="scene-inner scene-copy">${inner}</div>
    ${over}
  </div>`;
}

function scene(
  name: keyof typeof SCENES | string,
  modifier: "village" | "room",
  inner: string,
  // Anything that lies on the picture rather than in the centred copy
  // column — the house cards. It is a sibling of the copy so its
  // percentages are percentages of the photograph.
  over = "",
): string {
  const meta = SCENES[name];
  const widths = [760, 1200, 1672];
  const srcset = widths.map((w) => `/img/${name}-${w}.webp ${w}w`).join(", ");
  return `<div class="scene scene-${modifier}">
    <img class="scene-photo" src="/img/${name}-1200.webp" srcset="${srcset}" sizes="100vw"
      width="1672" height="941" decoding="async" alt="${esc(meta?.alt ?? "")}">
    <div class="scene-inner scene-copy">${inner}</div>
    ${over}
  </div>`;
}

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
  houses: Array<House & { hereNames: string[]; counts: { inRoom: number; onShelf: number } }>,
  me: Person,
  message: string | null,
): string {
  // The cards lie on the photograph, one over roughly its own house, and
  // each says the two things you want before you decide where to go: who is
  // in there, and how much is kept there. Who is here is written out, not
  // only drawn as discs — presence is state, and state is carried in text.
  const cards = houses
    .map((h) => {
      const here = h.hereNames.length;
      const presence = here
        ? `${names(h.hereNames)} ${here === 1 ? "is" : "are"} here`
        : "Nobody is here";
      const yours = h.slug === me.homeSlug ? " · yours" : "";
      return `<li>
        <a class="float-card" href="/house/${esc(h.slug)}" data-kind="${h.kind === "meeting" ? "meeting" : "home"}">
          ${faces(h.hereNames)}
          <span class="float-text">
            <span class="float-name">${esc(h.name)}</span>
            <span class="float-meta">${esc(presence)}${yours} · ${h.counts.onShelf} kept</span>
          </span>
          <span class="float-go" aria-hidden="true">›</span>
        </a>
      </li>`;
    })
    .join("");
  return page(
    "The village",
    `<main>
      ${scene(
        "village",
        "village",
        `<span class="scene-eyebrow">Four places. One family.</span>
        <h1>The village</h1>
        <p class="lede">A place for our family memories, across distance.</p>
        <p class="scene-sub">What you put down stays in the room you put it in. It reaches
          a house's shelf once somebody else writes their own perspective on it and keeps
          it together — a memory is something two of you were there for.</p>
        ${message ? `<p class="scene-notice" role="status">${esc(message)}</p>` : ""}`,
        `<ul class="scene-cards">${cards}</ul>
        <p class="hand scene-hint">Click a house<br>to step inside.</p>`,
      )}
      <p class="quiet measured village-foot">The map updates on its own as people arrive and leave.</p>
    </main>`,
    me,
    "map",
  );
}

/** The board, as a page element.
 *
 *  Picking a pit and choosing a direction are two interactions, and nothing
 *  is written until the second one. The first is a GET that carries ?pit= —
 *  a link, not a form, so it costs no state anywhere and works with
 *  JavaScript off. The second is an ordinary form POST, like every other
 *  action in this app.
 *
 *  Each pit is rendered as a link when it is yours and playable, and as a
 *  plain cell when it is not. A disabled-looking button you can still click
 *  would be the dishonest option; a cell that is simply not a control says
 *  what is true. */
function boardPanel(g: GameView, houseSlug: string, picked: number | null): string {
  const selectable = new Set(g.playable);
  const isPicked = (i: number): boolean => picked === i && selectable.has(i);

  const cell = (i: number): string => {
    const pit = g.board[i];
    const stones = pit.dan + pit.quan;
    const label = pit.quan > 0 ? `${pit.dan + pit.quan * 10}` : `${pit.dan}`;
    const inner = `<span class="pit-count">${esc(label)}</span>
      <span class="visually-hidden">${
        pit.quan > 0
          ? `a quan and ${pit.dan} ${pit.dan === 1 ? "stone" : "stones"}`
          : `${pit.dan} ${pit.dan === 1 ? "stone" : "stones"}`
      }</span>`;
    const quanClass = isQuanPit(i) ? " pit-quan" : "";
    if (!selectable.has(i)) {
      return `<li class="pit${quanClass}" data-stones="${stones}">${inner}</li>`;
    }
    const href = isPicked(i)
      ? `/house/${esc(houseSlug)}`
      : `/house/${esc(houseSlug)}?pit=${i}`;
    return `<li class="pit${quanClass}" data-stones="${stones}">
      <a class="pit-pick" href="${href}"${isPicked(i) ? ' aria-current="true"' : ""}>
        ${inner}
      </a>
    </li>`;
  };

  // Top row reads right-to-left so that the board on screen matches the
  // ring the stones actually travel: 7..11 laid out above 1..5 would put
  // pit 7 above pit 1 and make "sow right" look like it goes two ways.
  const topRow = [11, 10, 9, 8, 7].map(cell).join("");
  const bottomRow = [1, 2, 3, 4, 5].map(cell).join("");

  const directions =
    picked !== null && selectable.has(picked)
      ? `<form class="sow" method="post" action="/game/move">
          <input type="hidden" name="house" value="${esc(houseSlug)}">
          <input type="hidden" name="pit" value="${picked}">
          <button class="primary" name="dir" value="left">← Sow left</button>
          <button class="primary" name="dir" value="right">Sow right →</button>
          <a class="cancel" href="/house/${esc(houseSlug)}">Cancel selection</a>
        </form>`
      : "";

  return `<div class="board-wrap">
    <p class="board-side-label">${esc(g.topName ?? "The empty chair")}’s side</p>
    <div class="board">
      <div class="quan-end">${cell(0)}</div>
      <div class="board-rows">
        <ul class="pit-row">${topRow}</ul>
        <ul class="pit-row">${bottomRow}</ul>
      </div>
      <div class="quan-end">${cell(6)}</div>
    </div>
    <p class="board-side-label">${esc(g.bottomName)}’s side</p>
    ${directions}
  </div>`;
}

/** What the board says in words. State is carried in text, never by a
 *  highlighted cell alone — the same rule the two-state label follows. */
function boardStatus(g: GameView, picked: number | null): string {
  if (g.ended === "stopped") {
    return "This game was ended before it finished, so there's no score for it.";
  }
  if (g.final) {
    const who =
      g.winner === "draw"
        ? "It was a draw"
        : `${g.winner === "bottom" ? g.bottomName : g.topName} won`;
    return `${who} — ${g.bottomName} ${g.final.bottom}, ${g.topName ?? "nobody"} ${g.final.top}.`;
  }
  if (!g.top) {
    return `${g.bottomName} has set out a board and is waiting for somebody to sit down.`;
  }
  const mover = g.turn === "bottom" ? g.bottomName : g.topName;
  if (g.stuck) {
    const loser = g.stuck === "bottom" ? g.bottomName : g.topName;
    const winner = g.stuck === "bottom" ? g.topName : g.bottomName;
    return `${loser}'s five pits are empty and there aren't five points to refill with, so the game goes to ${winner ?? "the other chair"}. Someone needs to call it.`;
  }
  if (g.mustRefill) {
    return `${mover}'s five pits are empty — their turn starts by paying five points to refill.`;
  }
  if (!g.yourTurn) return `It's ${mover}'s turn.`;
  if (picked !== null && g.playable.includes(picked)) {
    const pit = g.board[picked];
    const n = pit.dan;
    return `Pit picked up · ${n} ${n === 1 ? "stone" : "stones"} in hand. Which way would you like to sow?`;
  }
  return "Your turn. Choose any pit on your side with stones in it.";
}

/** The panel beside the board: who is playing, the score, and the one
 *  action available to the viewer. */
function tablePanel(g: GameView | null, houseSlug: string, watching: number): string {
  if (!g || g.ended) {
    const past = g?.ended
      ? `<p class="note">${
          g.ended === "stopped"
            ? "The last game was ended early, so it has no score."
            : `Last game: ${esc(g.bottomName)} ${g.final?.bottom ?? 0}, ${esc(g.topName ?? "nobody")} ${g.final?.top ?? 0}.`
        }</p>`
      : "";
    // Only a finished game, only to the two who played it, and only once.
    // A game ended early has no result to keep — the button is absent
    // rather than present-and-refusing, because there is nothing there to
    // offer. `canPlace` is false for every other case, so this one
    // condition carries all of it.
    const keep =
      g?.canPlace && g.yourSide
        ? `<form method="post" action="/game/place">
            <input type="hidden" name="house" value="${esc(houseSlug)}">
            <button>Put this game in the room</button>
          </form>
          <p class="note">It reaches the shelf when the other player adds their side of it.</p>`
        : "";
    return `<div class="card">
      <h3 class="rule-title">Ô ăn quan</h3>
      <p class="body-sm">A little strategy. A lot of childhood.</p>
      ${past}
      ${keep}
      <form method="post" action="/game/sit">
        <input type="hidden" name="house" value="${esc(houseSlug)}">
        <button class="primary">Set out a board</button>
      </form>
    </div>`;
  }

  const chair = (side: "bottom" | "top"): string => {
    const name = side === "bottom" ? g.bottomName : g.topName;
    const score = g.scores[side];
    const yours = g.yourSide === side ? " · you" : "";
    const toMove = !g.ended && g.turn === side && g.top ? " · to move" : "";
    if (!name) {
      return `<li class="chair chair-empty">
        <span class="chair-name">The empty chair</span>
        <form method="post" action="/game/sit">
          <input type="hidden" name="house" value="${esc(houseSlug)}">
          <button>Sit down</button>
        </form>
      </li>`;
    }
    return `<li class="chair">
      ${face(name)}
      <span class="chair-name">${esc(name)}${esc(yours)}${esc(toMove)}</span>
      <span class="chair-score">${score}</span>
    </li>`;
  };

  // Three different things a player might do, and they are genuinely
  // different endings rather than three names for one:
  //
  //   call it   — the board says somebody has lost; this records the score.
  //   end it    — walk away; NO score, no winner, nothing to keep.
  //   leave     — nothing has been played yet, so nothing is ended at all.
  //
  // Only one is ever shown, because only one of them is true at a time.
  const action = !g.yourSide
    ? ""
    : g.stuck
      ? `<form method="post" action="/game/concede">
          <input type="hidden" name="house" value="${esc(houseSlug)}">
          <button class="primary">Call it — ${esc(
            (g.stuck === "bottom" ? g.topName : g.bottomName) ?? "the other chair",
          )} wins</button>
        </form>`
      : g.moveCount > 0
        ? `<form method="post" action="/game/end">
            <input type="hidden" name="house" value="${esc(houseSlug)}">
            <button>End this game</button>
          </form>
          <p class="note">Ending early leaves no score — it's a game nobody won.</p>`
        : `<form method="post" action="/game/stand">
            <input type="hidden" name="house" value="${esc(houseSlug)}">
            <button>Leave the table</button>
          </form>`;

  return `<div class="card">
    <h3 class="rule-title">At the table</h3>
    <p class="note">${g.top ? "2 playing" : "1 waiting"} · ${watching} ${watching === 1 ? "watching" : "watching"}</p>
    <ul class="chairs">${chair("bottom")}${chair("top")}</ul>
    <p class="note">Dân 1 point · quan 10 · no timer</p>
    ${action}
  </div>`;
}

/** The rules, as a disclosure. `<details>` is keyboard-operable, works with
 *  JavaScript off, and needs no script — so the one place in this app that
 *  explains a game does not become the one place that requires a runtime. */
function rulesDrawer(): string {
  const rule = (n: string, title: string, body: string): string =>
    `<div class="rule"><h4>${esc(n)} ${esc(title)}</h4><p>${esc(body)}</p></div>`;
  return `<details class="rules">
    <summary>How to play ô ăn quan</summary>
    <div class="rules-body">
      <p class="lede">Collect the most points by sowing and capturing stones.</p>
      ${rule("01", "Set the table", "Ten small pits start with five dân each; the two end pits hold one quan each. You own the five small pits nearest you.")}
      ${rule("02", "Sow your stones", "Pick a non-empty small pit on your side. Sow all its stones, one per pit, left or right around the whole board, including both quan pits.")}
      ${rule("03", "Keep going — or stop", "After your last drop, look at the next pit. An occupied small pit: pick it up and keep sowing the same way. An occupied quan pit, or two empty pits: stop.")}
      ${rule("04", "Capture across a gap", "If the next pit is empty and the one beyond it holds stones, capture that second pit. Repeat across further empty-then-occupied pairs, then end your turn.")}
      ${rule("05", "Refill an empty side", "If your five pits are empty at the start of your turn, pay five captured points to put one dân in each. Fewer than five points and the game is lost.")}
      ${rule("06", "Finish and count", "When both quan pits are empty, each of you collects the dân left on your own side and adds it to what you captured. The higher score wins; equal scores are a draw.")}
      <p class="quiet">Our house rules: quan counts 10, no mature-quan restriction, no borrowing, no timer.</p>
    </div>
  </details>`;
}

/** The table, as a fragment the live stream can swap in on its own. It is
 *  the board's counterpart to `roomFragment`: everything inside `#table`,
 *  and nothing outside it, so the resync can replace one with the other
 *  without the page having to know what changed.
 *
 *  Keeping the whole table in one fragment rather than updating pits
 *  individually means the status line, the chairs and the board can never
 *  disagree with each other — they are always one render of one position. */
export function tableFragment(
  game: GameView | null,
  houseSlug: string,
  picked: number | null,
  othersHere: number,
): string {
  return `<div class="table-board">
      ${
        game
          ? // The board is drawn for a finished game too, not just a live
            // one. The final position is how you see HOW somebody won —
            // which quan went when, whose side emptied — and a result line
            // floating over the space where the board used to be says less
            // and looks like something failed to load. `picked` is dropped
            // once the game is over, because there is nothing to pick up.
            `<p class="board-status"${game.ended ? "" : ' role="status"'}>${esc(
              boardStatus(game, game.ended ? null : picked),
            )}</p>
             ${boardPanel(game, houseSlug, game.ended ? null : picked)}`
          : `<p class="board-status">Nobody has set out a board. Ô ăn quan takes two.</p>`
      }
      ${rulesDrawer()}
    </div>
    <div class="table-side">
      ${tablePanel(game, houseSlug, othersHere)}
    </div>`;
}

/** What actually moves a thing to the shelf: never presence alone, always a
 *  distinct second member writing their own perspective and choosing to
 *  keep it together. Presence names are still shown, since who is around is
 *  still useful to know — just not framed as the cause. */
function consequenceLine(otherNames: string[]): string {
  const whoIsHere = otherNames.length
    ? `${names(otherNames)} ${otherNames.length === 1 ? "is" : "are"} here right now. `
    : "";
  return `${whoIsHere}What you put down stays in the room on its own. It only reaches the shelf once someone else writes their own perspective on it and chooses to keep it together — being in the room at the same time isn't enough by itself.`;
}

export function housePage(
  house: House,
  me: Person,
  /** Everyone else who has been here inside the TTL. The caller excludes the
   *  viewer by token before this is called — see the note in the route. */
  otherNames: string[],
  things: ThingView[],
  message: string | null,
  /** The meeting house only: the game at the table and which pit the
   *  viewer has picked up. Optional so the three household houses, and
   *  every existing caller, carry on unchanged. */
  table?: { game: GameView | null; picked: number | null },
): string {
  const isMeeting = house.slug === "meeting";
  const composeLabel = isMeeting ? "What do you want to say at the table?" : "What do you want to put down here?";
  // "Send" at the table, because that is the word for saying something to a
  // room. "Put this down" stays in the houses, where the verb really is
  // placing an object somewhere it will stay.
  const composeButton = isMeeting ? "Send" : "Put this down";
  const quietLine = isMeeting
    ? "Whatever is said here reaches everyone in the room. No alerts, no unread marks."
    : "No notifications, no alerts. You find out by visiting.";
  // The meeting house's thread has no height limit or scrollbar of its own —
  // it grows with the page, oldest message at the top. The page loads at the
  // top, same as any other page; no initial jump to the bottom is needed,
  // since reading oldest-to-newest naturally ends at the newest message
  // anyway. After a live resync swaps in fresh messages, the newest one is
  // brought into view — but only when the reader was already near the
  // bottom before the swap, so scrolling up to read older messages is never
  // undone out from under them. `scrollIntoView`'s own `behavior` is picked
  // at call time from `prefers-reduced-motion`, so this jumps rather than
  // animates for anyone who asked for that.
  const scrollHelper = isMeeting
    ? `const scrollToNewestMessage = () => {
          const items = room.querySelectorAll("li.thread-msg");
          const last = items[items.length - 1];
          if (!last) return;
          const behavior = window.matchMedia("(prefers-reduced-motion: no-preference)").matches ? "smooth" : "auto";
          last.scrollIntoView({ block: "nearest", behavior });
        };`
    : "";
  const nearBottomCheck = isMeeting
    ? `const wasNearBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 200);`
    : "";
  const scrollAfterSwap = isMeeting ? "\n            if (wasNearBottom) scrollToNewestMessage();" : "";
  return page(
    house.name,
    `<main>
      ${roomScene(
        house.slug,
        `<a class="scene-back" href="/">← Back to the village</a>
        <h1>${esc(house.name)}</h1>
        <p class="lede">${esc(eyebrowFor(house.slug))}.</p>
        <p class="scene-presence">
          ${faces(otherNames)}
          <span>${
            // `names` escapes each name itself, so this is already safe and
            // must not be escaped again or the ampersand in a name doubles.
            otherNames.length
              ? `${names(otherNames)} ${otherNames.length === 1 ? "is" : "are"} here right now`
              : "Nobody else is here right now"
          }</span>
        </p>
        ${message ? `<p class="scene-notice" role="status">${esc(message)}</p>` : ""}`,
      )}
      ${
        // The board sits above the conversation, because it is the thing
        // people came to the table for; the talk goes on beside and under
        // it, the way it does around a real one.
        //
        // The id is what makes the board live. It is a sibling of #room
        // rather than part of it, so the resync below has to fetch and
        // swap both: a board that only updated when you reloaded would be
        // a game of correspondence chess, not a game at the same table.
        isMeeting && table
          ? `<section id="table" class="table-area measured">${tableFragment(
              table.game,
              house.slug,
              table.picked,
              otherNames.length,
            )}</section>`
          : ""
      }
      <div class="layout-house measured">
        <div>
          <div id="room">${roomFragment(otherNames, things, house.slug)}</div>
        </div>
        <div class="panel-stack">
          <div class="card">
            <h3 class="rule-title">The two-state rule</h3>
            <p class="body-sm"><strong>In the room</strong> — nobody has kept this together yet.</p>
            <p class="body-sm"><strong>On the shelf</strong> — someone wrote their own perspective and chose to keep it together, and it stays.</p>
          </div>
          <div class="card-raised">
            <p class="consequence">${esc(consequenceLine(otherNames))}</p>
          </div>
          <!-- At the table this is one box, because a remark is not an
               artefact: it has no title and no "when did this happen",
               and asking for either would be a small lie about what is
               being written. In a household house, where a thing can reach
               the shelf under its own name, both still earn their place. -->
          <form method="post" action="/place"${isMeeting ? ' class="say"' : ""}>
            <input type="hidden" name="house" value="${esc(house.slug)}">
            ${
              isMeeting
                ? ""
                : `<label for="title">Give it a title</label>
            <input id="title" name="title" required maxlength="120" placeholder="His first steps">`
            }
            <label for="body"${isMeeting ? ' class="visually-hidden"' : ""}>${esc(composeLabel)}</label>
            <input id="body" name="body" required maxlength="280"
              placeholder="${isMeeting ? "Send a message…" : "He stood up on his own today"}">
            ${
              isMeeting
                ? ""
                : `<label for="event_date">When did this happen? <span class="note">(optional)</span></label>
            <input id="event_date" name="event_date" maxlength="40" placeholder="March 2019, or any time you like">`
            }
            <button class="primary">${esc(composeButton)}</button>
          </form>
          <p class="quiet">${esc(quietLine)}</p>
        </div>
      </div>
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        // Null in the three household houses, which have no table.
        const table = document.getElementById("table");
        ${scrollHelper}
        const stream = new EventSource("/stream?house=" + encodeURIComponent(${JSON.stringify(house.slug)}));
        const slug = encodeURIComponent(${JSON.stringify(house.slug)});
        const swap = async (el, path) => {
          const res = await fetch("/house/" + slug + path, { headers: { accept: "text/html" } });
          if (res.ok) el.innerHTML = await res.text();
          return res.ok;
        };
        const resync = async () => {
          ${nearBottomCheck}
          // The board first: when somebody has just moved, that is what the
          // person watching is waiting to see. Both are fetched either way,
          // because one event can change both.
          //
          // The pit you have picked up rides along, because it lives in the
          // URL and the fragment has no other way to know about it. Without
          // this, anyone else saying anything in the room — which is an
          // event like any other — would put your stones back down
          // mid-move, and you would never work out why.
          if (table) {
            const pit = new URLSearchParams(location.search).get("pit");
            await swap(table, "/table" + (pit === null ? "" : "?pit=" + encodeURIComponent(pit)));
          }
          if (await swap(room, "/room")) {${scrollAfterSwap}
          }
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
    // Only the meeting house is in the nav; the three household rooms are
    // reached from the map, so nothing is marked current while you're in one.
    isMeeting ? "meeting" : undefined,
  );
}

const isFilteredFrom = (f: { year: string; q: string; house: string }): boolean =>
  Boolean(f.house || f.year || f.q);

/** One kept thing, as a card on the wall. Keeps `li.thing` because that is
 *  what the route tests look for, and because a shelf card and a room slip
 *  really are the same object seen in two places.
 *
 *  The two names are the point of the whole app, so they are the loudest
 *  line on the card after the title — not a footnote. */
function shelfCard(t: ThingView, house: House): string {
  const everyone = [t.placedByName, ...t.keeperNames];
  return `<li class="thing card-shelf">
    <div class="card-shelf-body">
      ${titleLine(t, "h3")}
      <p class="body">${esc(t.body)}</p>
      ${t.perspectives.length ? perspectivesList(t) : ""}
    </div>
    <div class="card-shelf-foot">
      <p class="card-shelf-where">
        <span class="chip chip-house" data-house="${esc(house.slug)}">${esc(house.name)}</span>
        ${t.eventDate ? `<span class="note">${esc(t.eventDate)}</span>` : ""}
      </p>
      <p class="card-shelf-who">
        ${faces(everyone)}
        <span class="state" data-state="on-the-shelf">Kept together by ${esc(t.placedByName)} &amp; ${names(t.keeperNames)}</span>
      </p>
    </div>
  </li>`;
}

export function shelfPage(
  houses: Array<House & { shelved: ThingView[] }>,
  me: Person,
  message: string | null,
  filters: { year: string; q: string; house: string },
  years: string[],
): string {
  const visibleHouses = filters.house
    ? houses.filter((h) => h.slug === filters.house)
    : houses;
  const totalShown = visibleHouses.reduce((n, h) => n + h.shelved.length, 0);
  // One wall rather than a section per house: the shelf's argument is that
  // these are the family's memories, not four separate collections, and a
  // card says which house it came from anyway. The house headings stay as
  // the filter, which is where choosing a house belongs.
  const everything = visibleHouses.flatMap((h) =>
    h.shelved.map((t) => shelfCard(t, h)),
  );
  const wall = everything.length
    ? `<ol class="wall">${everything.join("")}</ol>`
    : `<p class="empty">${
        isFilteredFrom(filters)
          ? "Nothing on the shelf matches those filters."
          : "Nothing is on the shelf yet. A thing reaches it once someone other than whoever put it down writes their own perspective and keeps it together."
      }</p>`;
  const houseOptions = houses
    .map(
      (h) =>
        `<option value="${esc(h.slug)}"${filters.house === h.slug ? " selected" : ""}>${esc(h.name)}</option>`,
    )
    .join("");
  const yearOptions = years
    .map((y) => `<option value="${esc(y)}"${filters.year === y ? " selected" : ""}>${esc(y)}</option>`)
    .join("");
  const isFiltered = isFilteredFrom(filters);
  return page(
    "The memory shelf",
    `<main class="measured">
      <div class="shelf-head">
        <div class="shelf-head-copy">
          <h1>The memory shelf</h1>
          <p class="lede">Only the things more than one of you were there for.</p>
          <p class="note">No compose box here — the shelf is for looking at. Everything
            on it carries two names and the day it was kept.</p>
        </div>
        <p class="hand shelf-aside">Same people.<br>Different places.<br>A fuller story.</p>
      </div>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="get" action="/shelf" class="shelf-filters">
        <div>
          <label for="shelf-house">House</label>
          <select id="shelf-house" name="house">
            <option value="">Every house</option>
            ${houseOptions}
          </select>
        </div>
        <div>
          <label for="shelf-year">Kept in</label>
          <select id="shelf-year" name="year">
            <option value="">Any year</option>
            ${yearOptions}
          </select>
        </div>
        <div>
          <label for="shelf-q">Search</label>
          <input id="shelf-q" name="q" value="${esc(filters.q)}" placeholder="a word from the story">
        </div>
        <button class="primary">Filter</button>
        ${isFiltered ? `<a href="/shelf">Clear</a>` : ""}
      </form>
      <p class="note shelf-count">${totalShown} ${totalShown === 1 ? "memory" : "memories"} shown${isFiltered ? " for these filters" : ""}.</p>
      ${wall}
    </main>`,
    me,
    "shelf",
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
