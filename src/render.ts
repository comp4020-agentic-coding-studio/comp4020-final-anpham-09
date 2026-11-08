import { DESIGN_STYLE } from "./design.ts";
import type { GameView } from "./games.ts";
import { hasPicture, houseBySlug, type House } from "./houses.ts";
import { mayPlace } from "./members.ts";
import { isQuanPit } from "./oanquan.ts";
import { displayName, getPerson, type Person } from "./people.ts";
import { householdOf } from "./accounts.ts";
import { NOTES_A_DAY, type NoteDay, type ThingView } from "./things.ts";
import { sizeOfName } from "./photos.ts";

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
  --board:#E9D5B6; --pit:#F5E7CF; --board-edge:#BEA17C; --pebble:#8E7E66;
  --scene-shadow:#24150F;
  /* Bookbinding. A cover has to read as an object standing in a room
     rather than as another card on the page, and the paper palette holds
     nothing dark enough to do that — so the three leathers are their own
     tokens. They stay dark in both themes, because a leather album is
     dark; what changes is how much light is in them. Measured on the
     cover: --on-book is 9.3:1 on Nghe An, 9.9:1 on Hanoi and 12.2:1 on
     Canberra, and the foil 6.3:1 on the darkest of the three. */
  --book-nghe-an:#7B2014; --book-hanoi:#174534; --book-canberra:#1E2E52;
  --book-foil:#E7C698; --on-book:#FAF2E8; --book-edge:#EAE2D2;
  /* Inside an opened book: the leaf, and the lighter piece pasted onto
     it. The card has to be the brighter of the two in both themes, or a
     memory stops looking like something laid on the page. */
  --leaf:#F2EADC; --leaf-card:#FDFAF4;
  --scrim:rgba(30,16,10,.58);
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
    --board:#493A2C; --pit:#372E25; --board-edge:#927859; --pebble:#D2B68F;
    /* The leathers lift rather than darken, for the same reason the
       terracotta does: a cover darker than the page behind it stops being
       an object and becomes a hole. Re-measured on the lifted ones. */
    --book-nghe-an:#8E3326; --book-hanoi:#1F5A45; --book-canberra:#2E4578;
    --book-foil:#E0BE8E; --on-book:#F7EFE4; --book-edge:#4A3D32;
    --leaf:#221B17; --leaf-card:#302722;
    --scrim:rgba(0,0,0,.7);
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
/* The typing line. It reserves its own height whether or not anything is
   in it, so the compose box and everything under it do not jump a line
   down the moment somebody starts typing. */
.typing { min-height: 1.25rem; margin: .4rem 0 0; color: var(--ink-soft);
  font-size: .875rem; font-style: italic; }

form { display: grid; gap: .6rem; margin: 1.25rem 0; }
label { font-weight: 600; font-size: .9375rem; }
input, button, select, textarea { font: inherit; padding: .65rem .8rem; min-height: 44px;
  border: 1.5px solid var(--rule); border-radius: .5rem; background: var(--paper); color: var(--ink); }
button { cursor: pointer; font-weight: 600; }
button.primary { background: var(--hearth-fill); color: var(--on-hearth); border: none;
  box-shadow: 0 -2px 0 color-mix(in srgb, var(--ink) 15%, transparent) inset; }
button.primary:hover { background: var(--hearth-deep); }
:is(a, button, input, select, textarea, summary):focus-visible {
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
/* The table reads as a chat window: the messages scroll inside their own
   panel and the composer sits under them, always reachable, instead of
   across the page in the side panel. Capped by viewport height so the
   composer is on screen without scrolling the document to find it.

   The min-height:0 on the scroller is load-bearing — a grid child defaults
   to min-content and refuses to shrink, so without it the panel grows to
   fit every message and nothing scrolls. */
.room-collection.conversation { display: grid; grid-template-rows: auto 1fr auto;
  max-height: min(72vh, 46rem); gap: .75rem; }
.room-collection.conversation > #room { overflow-y: auto; min-height: 0;
  padding-right: .35rem; scrollbar-gutter: stable; }
.room-collection.conversation .composer { border-top: 1px solid var(--rule);
  padding-top: .75rem; background: var(--bg); }
.room-collection.conversation .composer .say { margin: 0; }
/* On a narrow screen the viewport cap fights the on-screen keyboard, so
   the panel goes back to growing with the page. */
@media (max-width: 768px) {
  .room-collection.conversation { max-height: none; }
  .room-collection.conversation > #room { overflow-y: visible; }
}

li.thread-msg { display: flex; gap: .75rem; align-items: flex-start; }
/* Consecutive messages from one person read as one turn in the
   conversation: the monogram and the name line appear once, and the
   messages under them tuck in. Pure CSS off an attribute the server
   already knows, so it needs no script and survives a live swap. */
li.thread-msg[data-same-sender="true"] { margin-top: -.35rem; }
li.thread-msg[data-same-sender="true"] > .face { visibility: hidden; }
li.thread-msg[data-same-sender="true"] .thread-meta strong,
li.thread-msg[data-same-sender="true"] .thread-meta .chip { display: none; }
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
/* Hidden until focused, then a real, visible target — the skip-link
   pattern. Invisible to a mouse, one tab stop to a keyboard. */
.skip-to-composer { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; }
.skip-to-composer:focus { position: static; width: auto; height: auto; clip: auto;
  display: inline-block; margin: 0 0 .5rem; padding: .35rem .6rem; border-radius: .4rem;
  background: var(--hearth); color: var(--paper); font-size: .8125rem; text-decoration: none; }
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
/* Sowing, one beat per stone. Every rule here lives inside the
   reduced-motion query: the script does not run at all under reduce, and
   this makes sure nothing is left highlighted if it ever did. Colour alone
   carries no information — the counts in the pits are already correct and
   are what the board actually says. */
@media (prefers-reduced-motion: no-preference) {
  .board[data-sowing="true"] .pit { transition: transform .12s ease, box-shadow .12s ease; }
  /* A stone landing: the pit lifts for a beat. */
  .pit[data-beat="drop"] { transform: translateY(-3px); box-shadow: 0 0 0 2px var(--hearth); }
  /* The hand lifting a pit, at the start and at each relay. */
  .pit[data-beat="pick"], .pit[data-beat="relay"] { transform: scale(.94); box-shadow: inset 0 0 0 2px var(--hearth); }
  /* Points leaving the board. */
  .pit[data-beat="capture"] { transform: scale(1.06); box-shadow: 0 0 0 3px var(--sage, var(--hearth)); }
  /* Where the turn ended. Quieter than a capture: it is a stop, not a prize. */
  .pit[data-beat="stop-quan"], .pit[data-beat="stop-empty"] { box-shadow: inset 0 0 0 2px var(--rule); }
}
/* The shelf is a bookcase: one book per household, standing on a board,
   and read by taking it down and opening it.

   There are two states here and the plain one is the one the server
   sends. With no script every album is a heading followed by every page
   it holds, in order, down the page — the complete readable list CLAUDE.md
   promises. The script adds the class that stands the books up, shuts
   them, and turns one leaf at a time. A script that fails to parse leaves
   the readable shelf exactly as it was: the failure mode is the degraded
   mode. */
.bookcase { display: grid; gap: 1.75rem; margin: 1.75rem 0 0; }

/* A book, not a panel. The cover carries the household's leather, the
   binding is a darker band down the hinge with the stitching beside it,
   and the fore-edge shows the stack of leaves.

   --scene-shadow is the one colour that does not flip between themes, so
   it is what darkens the hinge: mixing with --ink would lighten it in the
   dark theme and turn the binding into a highlight. */
.album { --leather: var(--book-nghe-an); position: relative; }
.album[data-album="hanoi"] { --leather: var(--book-hanoi); }
.album[data-album="canberra"] { --leather: var(--book-canberra); }

.album-title { margin: 0; font-size: 1rem; }
a.album-cover {
  position: relative; z-index: 1; display: flex; overflow: hidden;
  align-items: baseline; gap: .75rem;
  padding: 1.1rem 1.25rem 1.1rem 50px;
  text-decoration: none; color: var(--on-book);
  border-radius: .3rem .85rem .85rem .3rem;
  background:
    linear-gradient(90deg,
      color-mix(in srgb, var(--scene-shadow) 70%, var(--leather)) 0 24px,
      color-mix(in srgb, var(--book-foil) 22%, var(--leather)) 24px 27px,
      color-mix(in srgb, var(--scene-shadow) 34%, var(--leather)) 27px 33px,
      transparent 33px),
    linear-gradient(100deg, var(--leather) 34%, color-mix(in srgb, var(--book-foil) 9%, var(--leather)) 100%);
  box-shadow: var(--shadow-2);
}
/* Gold-blocked border, the way a bound album is tooled. */
a.album-cover::before {
  content: ""; position: absolute; inset: 7px 9px 7px 40px; border-radius: .25rem;
  border: 1px solid color-mix(in srgb, var(--book-foil) 38%, transparent);
  pointer-events: none;
}
/* The stitching: a dashed thread just inside the binding. */
.album::before {
  content: ""; position: absolute; z-index: 2; left: 15px; top: 14px; bottom: 14px; width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--book-foil) 55%, transparent);
  pointer-events: none;
}
/* The fore-edge: the leaves, seen end on. */
.album::after {
  content: ""; position: absolute; z-index: 2; right: -3px; top: 9px; bottom: 9px; width: 6px;
  border-radius: 0 2px 2px 0;
  background: repeating-linear-gradient(180deg,
    var(--book-edge) 0 2px, color-mix(in srgb, var(--scene-shadow) 22%, var(--book-edge)) 2px 3px);
  box-shadow: 0 1px 4px -1px var(--scene-shadow);
  pointer-events: none;
}

.album-volume { display: block; font-size: .625rem; letter-spacing: .22em;
  text-transform: uppercase; font-weight: 700; color: var(--book-foil); }
.album-house { font-family: var(--display); font-weight: 700; font-size: 1.35rem; letter-spacing: -.01em; }
.album-span { font-size: .8125rem; color: color-mix(in srgb, var(--on-book) 76%, transparent); }
.album-foot { margin-left: auto; display: flex; align-items: center; gap: .9rem; }
.album-count { font-size: .8125rem; color: color-mix(in srgb, var(--on-book) 82%, transparent); }
/* Says what the cover does. It is a link to the open book below it, which
   is exactly what it does when there is no script to intercept it. */
.album-cue {
  font-size: .75rem; font-weight: 600; padding: .5rem .7rem; border-radius: .25rem;
  background: color-mix(in srgb, var(--on-book) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--book-foil) 45%, transparent);
}
a.album-cover:hover .album-cue { background: var(--on-book); color: var(--leather); }
a.album-cover:focus-visible { outline: 3px solid var(--hearth); outline-offset: 2px; }

/* --- With a script: three books standing on a shelf --- */
.bookcase.standing {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.1rem; align-items: end;
  padding: 2.5rem 1.4rem 0; border-radius: .5rem;
  background: radial-gradient(120% 90% at 50% 0%,
    color-mix(in srgb, var(--amber) 13%, transparent) 0%, transparent 62%), var(--card);
}
/* The board they stand on. */
.bookcase.standing::after {
  content: ""; grid-column: 1 / -1; height: 15px; margin: 1.1rem -1.4rem 0;
  border-radius: 0 0 .5rem .5rem;
  background: linear-gradient(180deg, var(--board) 0 45%, var(--board-edge) 45%);
  box-shadow: 0 14px 22px -14px var(--scene-shadow);
}
.bookcase.standing a.album-cover {
  flex-direction: column; align-items: stretch; gap: .5rem;
  aspect-ratio: 3 / 4; padding: 1.4rem 1.1rem 1.1rem 46px;
}
.bookcase.standing .album-volume::after {
  content: ""; display: block; width: 3.2rem; height: 2px; margin-top: .4rem;
  background: linear-gradient(90deg, var(--book-foil), transparent);
}
.bookcase.standing .album-house { font-size: 1.6rem; line-height: 1.15; }
/* The crest: tooled into the leather rather than printed on it, because an
   emblem standing for a real house would be a claim the app cannot make. */
.bookcase.standing a.album-cover::after {
  content: ""; position: absolute; left: calc(50% + 20px); top: 50%; width: 78px; height: 78px;
  transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--book-foil) 62%, transparent);
  background: radial-gradient(circle at 50% 36%,
    color-mix(in srgb, var(--book-foil) 20%, transparent) 0%, transparent 72%);
  box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--scene-shadow) 30%, transparent),
              inset 0 0 0 6px color-mix(in srgb, var(--book-foil) 34%, transparent),
              0 1px 0 color-mix(in srgb, var(--book-foil) 22%, transparent);
}
.bookcase.standing .album-foot {
  margin: auto 0 0; padding-top: .7rem;
  border-top: 1px solid color-mix(in srgb, var(--book-foil) 32%, transparent);
  justify-content: space-between; gap: .5rem;
}
.bookcase.standing .album-span { font-size: .75rem; }

/* --- The open book --- */
/* A <dialog> is an ordinary block here until the script opens one: the UA
   hides a closed dialog, so the base rule puts it back. With no script
   nothing ever calls showModal(), and this is simply the book, open,
   under its heading. */
.album-book {
  display: block; position: static; inset: auto; z-index: auto;
  width: auto; max-width: none; height: auto; max-height: none;
  margin: 0; padding: .9rem 1.25rem 1.25rem 50px;
  border: 0; background: none; color: inherit; overflow: visible;
}
/* Shut. Set by the script and by nothing else, which is why a reader with
   no script never meets a book that will not open. */
.album[data-open="false"] .album-book { display: none; }
/* Open, it is a book held open in front of you: the board you just lifted
   is the frame, the two leaves are inside it, and the turn arrows sit off
   the fore-edges where a thumb would be. The frame carries this
   household's leather, so the thing on screen is the book you took down
   and not a panel that happens to hold its pages. */
.album[data-open="true"] .album-book {
  position: fixed; inset: 0; margin: auto;
  width: min(100% - 5.5rem, 72rem); height: min(100% - 3rem, 50rem);
  padding: 10px; overflow: visible;
  border-radius: .65rem;
  background: linear-gradient(145deg,
    color-mix(in srgb, var(--scene-shadow) 58%, var(--leather)),
    color-mix(in srgb, var(--scene-shadow) 76%, var(--leather)));
  box-shadow: 0 34px 80px -26px var(--scene-shadow),
              inset 0 0 0 1px color-mix(in srgb, var(--book-foil) 26%, transparent);
}
.album-book::backdrop { background: var(--scrim); }

.book-inner { display: flex; flex-direction: column; height: 100%; }
/* The leaves. One paper surface with the binding shaded down the middle
   of it, rather than two boxes with a line between them: an opened book
   is one sheet of light with a valley in it. */
.album[data-open="true"] .book-inner {
  padding: 1.15rem 1.5rem .85rem;
  border-radius: .35rem; overflow: hidden;
  background:
    /* The fold itself. --scene-shadow does not flip with the theme, so
       the valley below it only reads on light paper; this hairline is
       drawn in --rule, which does flip, and keeps the binding visible in
       the dark one. */
    linear-gradient(90deg, transparent calc(50% - 1px),
      var(--rule) calc(50% - 1px), var(--rule) calc(50% + 1px),
      transparent calc(50% + 1px)),
    linear-gradient(90deg, transparent calc(50% - 34px),
      color-mix(in srgb, var(--scene-shadow) 5%, transparent) calc(50% - 34px),
      color-mix(in srgb, var(--scene-shadow) 13%, transparent) calc(50% - 9px),
      color-mix(in srgb, var(--scene-shadow) 17%, transparent) 50%,
      color-mix(in srgb, var(--scene-shadow) 13%, transparent) calc(50% + 9px),
      color-mix(in srgb, var(--scene-shadow) 5%, transparent) calc(50% + 34px),
      transparent calc(50% + 34px)),
    var(--leaf);
}

/* The running head: which album this page belongs to, and its number.
   The same on every page, because a page slides from the right side to
   the left as the book is turned and a head that said which side it was
   on would be wrong one turn later. */
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: .75rem; margin: 0 0 .9rem; padding-bottom: .5rem;
  border-bottom: 1px solid var(--rule);
}
.page-where { display: inline-flex; align-items: center; gap: .45rem;
  font-family: var(--display); font-weight: 700; font-size: .95rem; }
.page-dot { width: .5rem; height: .5rem; border-radius: 50%; background: var(--leather); }
.page-no {
  font-size: .6875rem; letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-soft); padding: .22rem .5rem; border: 1px solid var(--rule);
  border-radius: .2rem; background: var(--leaf-card); font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.album-pages { display: grid; flex: 1; min-height: 0; }
/* Two pages side by side, with the binding between them. Hidden pages
   are not grid items, so whichever two are showing fall into the two
   columns in order — nothing has to be told which side it is on, which
   is what lets a page slide from one to the other.

   A scrollbar inside the book must not eat the page number out of the
   running head, which is what it did on a phone. */
.album[data-open="true"] .album-pages {
  grid-template-columns: 1fr 1fr; gap: 0 4.25rem; align-content: start;
  overflow: auto; scrollbar-gutter: stable; padding-right: .2rem;
}
/* :not([hidden]) is load-bearing, not decoration. A display declaration
   here outranks the UA's own rule hiding [hidden] elements, so without it
   the script hides a page, the page goes on rendering, and the whole
   album stacks up behind a control that says "Page 1 of 66". Found by
   looking at the screen, not by a test. */
.page:not([hidden]) { display: grid; align-content: start; padding: .2rem 0 0; }
.page-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: .85rem; align-content: start; }
.page-empty { padding: 1.1rem 0; }
/* Stacked, with no script, one page has to end before the next begins. */
.album-pages > .page + .page { margin-top: 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--rule); }
.album[data-open="true"] .album-pages > .page + .page { margin: 0; padding-top: .2rem; border-top: 0; }
/* Down the page with no script the cards are the paper itself, not boxes
   on top of it. */
.page .card-shelf { background: none; border: 0; box-shadow: none; border-radius: 0; }
.page .card-shelf + .card-shelf { border-top: 1px solid var(--rule); padding-top: 1rem; }
/* In the open book they are pasted in: separate pieces lying on the leaf,
   which is what a photograph album actually looks like. */
.album[data-open="true"] .page .card-shelf {
  background: var(--leaf-card); border: 1px solid var(--rule);
  border-radius: .45rem; padding: .9rem 1rem; box-shadow: var(--shadow-1);
}
.album[data-open="true"] .page .card-shelf + .card-shelf { border-top: 1px solid var(--rule); padding-top: .9rem; }

/* The colophon line along the bottom of the leaves. */
.book-foot:not([hidden]) {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: .5rem 1rem; margin: .7rem 0 0; padding-top: .65rem;
  border-top: 1px solid var(--rule);
}
.book-mark { display: inline-flex; align-items: center; gap: .4rem;
  font-family: var(--display); font-style: italic; font-size: .8125rem; color: var(--ink-soft); }
.book-turn:not([hidden]) { display: inline-flex; align-items: center; flex-wrap: wrap; gap: .5rem .75rem; }
.book-hint { font-size: .75rem; color: var(--ink-soft); }
.book-hint kbd { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: .8125rem;
  line-height: 1; border: 1px solid var(--rule); border-radius: .2rem; padding: .1rem .34rem;
  background: var(--leaf-card); }
.book-turn button, .album-close { font-size: .8125rem; padding: .55rem .9rem; min-height: 44px; }
.book-turn button[disabled] { opacity: .35; cursor: default; }
.album-where { font-size: .8125rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }

/* The thumb arrows, off the fore-edges. Duplicates of the footer buttons
   for a mouse, which is why the markup puts them out of the tab order:
   one Back and one Next for anybody not using a pointer. */
.book-arrow:not([hidden]) {
  position: absolute; top: 50%; translate: 0 -50%;
  display: flex; align-items: center; justify-content: center;
  width: 58px; height: 58px; padding: 0 0 .22rem; border-radius: 50%;
  font-family: var(--display); font-size: 2.1rem; line-height: 1;
  background: var(--paper); color: var(--ink);
  border: 1px solid var(--rule); box-shadow: var(--shadow-float); cursor: pointer;
}
.book-arrow.turn-back { left: -29px; }
.book-arrow.turn-next { right: -29px; }
.book-arrow:hover { background: var(--card-raised); }
.book-arrow[disabled] { opacity: .3; cursor: default; }

/* Three books do not fit across a phone, and an open spread is two pages
   wide only where there is room for two pages. */
@media (max-width: 760px) {
  .bookcase.standing { grid-template-columns: 1fr 1fr; gap: .9rem; }
  /* One leaf at a time, so there is no binding to shade and no fore-edge
     for a thumb arrow to sit off. The labelled footer buttons and the
     arrow keys are still both there. */
  .album[data-open="true"] .album-book { width: min(100% - 1.25rem, 72rem); padding: 6px; }
  .album[data-open="true"] .album-pages { grid-template-columns: 1fr; }
  .album[data-open="true"] .book-inner { background: var(--leaf); }
  .book-arrow:not([hidden]) { display: none; }
}
@media (max-width: 480px) {
  .bookcase.standing { grid-template-columns: 1fr; padding: 1.5rem 1rem 0; }
  .bookcase.standing a.album-cover { aspect-ratio: auto; min-height: 210px; }
  /* A squat cover has no middle to tool a crest into: at this width it
     lands across the dates instead. The binding, the foil frame and the
     fore-edge are enough to say "book" on their own. */
  .bookcase.standing a.album-cover::after { display: none; }
  a.album-cover { padding: .9rem 1rem .9rem 30px; }
  a.album-cover::before { inset: 6px 7px 6px 24px; }
  .album::before { left: 9px; }
  .album-book { padding: .8rem .85rem .9rem 30px; }
  .album[data-open="true"] .book-inner { padding: .9rem .95rem .7rem; }
  .album-house { font-size: 1.15rem; }
  /* The colophon goes; at this width the page number and the two buttons
     are what the bottom of the book is for. */
  .book-mark { display: none; }
  /* And a keyboard hint on a phone is advice nobody there can take. */
  .book-hint { display: none; }
  .book-foot:not([hidden]) { justify-content: center; gap: .5rem; }
  .book-turn:not([hidden]) { justify-content: center; }
}

/* Opening, shutting and turning. All of it inside the motion query: with
   reduced motion the book still opens and the pages still change, they
   simply do not swing. */
@media (prefers-reduced-motion: no-preference) {
  .bookcase.standing a.album-cover { transition: transform .3s ease, box-shadow .3s ease; }
  .bookcase.standing a.album-cover:hover { transform: translateY(-9px); box-shadow: var(--shadow-float); }
  /* The cover swinging back on its hinge — the binding is the axis. */
  .album[data-opening="true"] .album-book { animation: book-open .5s cubic-bezier(.2,.75,.3,1); }
  .album[data-closing="true"] .album-book { animation: book-shut .3s ease-in forwards; }
  .album-book { transform-origin: left center; }
  @keyframes book-open {
    from { opacity: 0; transform: perspective(1800px) rotateY(-74deg) scale(.92); }
    to   { opacity: 1; transform: perspective(1800px) rotateY(0) scale(1); }
  }
  @keyframes book-shut {
    from { opacity: 1; transform: perspective(1800px) rotateY(0) scale(1); }
    to   { opacity: 0; transform: perspective(1800px) rotateY(-74deg) scale(.92); }
  }
  /* Turning. One page moves: the leaf that was on the right comes down
     onto the left, hinged at the binding, and the page it covers is not
     animated out because it did not go anywhere — it was covered. The
     page that appears in the space left behind simply arrives. */
  .album-pages { perspective: 1800px; }
  .page { backface-visibility: hidden; }
  .page[data-turn="to-left"] { transform-origin: right center; animation: leaf-to-left .36s cubic-bezier(.3,.7,.3,1); }
  .page[data-turn="to-right"] { transform-origin: left center; animation: leaf-to-right .36s cubic-bezier(.3,.7,.3,1); }
  .page[data-turn="arrive"] { animation: leaf-arrive .36s ease-out; }
  @keyframes leaf-to-left {
    from { opacity: .35; transform: rotateY(82deg); }
    to   { opacity: 1; transform: rotateY(0); }
  }
  @keyframes leaf-to-right {
    from { opacity: .35; transform: rotateY(-82deg); }
    to   { opacity: 1; transform: rotateY(0); }
  }
  @keyframes leaf-arrive {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}

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
li.chair { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; padding: .5rem .6rem;
  background: var(--card-raised); border-radius: .6rem; }
/* A chair whose player has gone reads as vacated rather than occupied, so
   the table does not look busier than it is. */
li.chair[data-away="true"] { opacity: .72; }
li.chair[data-away="true"] .chair-name small { color: var(--ink-soft); }
/* The free-this-chair control takes its own line under the name and score,
   which is why the row wraps. Quiet: it is a tidy-up, not the main action
   at the table. */
li.chair .chair-free { flex-basis: 100%; }
li.chair .chair-free button { font-size: .8125rem; padding: .25rem .6rem; }
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

/* --- The drawers: the table, and the note board behind it --- */
/* A <dialog> is an ordinary block here until the script opens one. The user
   agent hides a closed dialog, so the base rule puts it back: with no
   script nothing ever calls showModal(), and these are simply the table and
   the board lying open under the room with everything in them. */
.drawer {
  display: block; position: static; inset: auto; z-index: auto;
  width: min(100% - 2.5rem, 54rem); height: auto; max-height: none;
  margin: 1.5rem auto 0; padding: 0; border: 0;
  background: none; color: inherit; overflow: visible;
}
/* Shut. Set by the script and by nothing else, which is why a reader with
   no script never meets a drawer that will not open. */
.drawer[data-drawer="shut"] { display: none; }
/* Pulled out: it lies over the room, and the room is still there behind the
   scrim. You have not gone to another page — you have gone to the table. */
.drawer[data-drawer="open"] {
  position: fixed; inset: 0; margin: auto;
  width: min(100% - 2.5rem, 52rem); height: min(100% - 2.5rem, 50rem);
  border-radius: 18px; background: var(--paper); color: var(--ink);
  box-shadow: 0 30px 70px -24px var(--scene-shadow);
}
.drawer::backdrop { background: var(--scrim); }
.drawer-inner { display: flex; flex-direction: column; gap: .9rem; min-height: 0; }
.drawer[data-drawer="open"] .drawer-inner { height: 100%; padding: 1.2rem 1.4rem 1.05rem; }
/* Only the contents scroll, so the heading that says which drawer this is
   and the composer under it both stay where they were put. */
.drawer[data-drawer="open"] > .drawer-inner > #room,
.drawer[data-drawer="open"] > .drawer-inner > #board-list {
  flex: 1; overflow: auto; min-height: 0; scrollbar-gutter: stable; padding-right: .2rem;
}
.drawer-head { display: flex; align-items: center; gap: .85rem;
  padding-bottom: .8rem; border-bottom: 1px solid var(--rule); }
.drawer-head h2 { font-size: 1.1rem; margin: 0; }
.drawer-words { display: grid; }
.drawer-words small { font-size: .8rem; color: var(--ink-soft); }
.drawer-art { display: grid; place-items: center; width: 38px; height: 38px;
  border-radius: 9px; background: var(--hearth-fill); color: var(--on-hearth); flex: none; }
.drawer-board .drawer-art { background: var(--sage-deep); }
/* :not([hidden]) because a display declaration outranks the user agent's
   own rule for [hidden] — without it the no-script page offers a button
   that shuts a drawer nothing can open. */
.drawer-close:not([hidden]) { display: inline-flex; align-items: center; margin-left: auto;
  min-height: 44px; padding: .4rem .85rem; font-size: .8125rem; flex: none; }
.drawer-foot { display: grid; gap: .8rem; padding-top: .85rem; border-top: 1px solid var(--rule); }
.drawer-foot .memory-compose { padding: 0; margin: 0; background: none; box-shadow: none; }
.drawer-foot .memory-compose h3 { margin: 0 0 .35rem; font-size: .95rem; }
/* The notes are what you came to the table for, so the thing you write
   them with stays small. rows="4" is the right size for the composer when
   it has a panel to itself; at the table it would take the page. */
.drawer-foot .memory-compose textarea { height: 4.5rem; min-height: 4.5rem; }
.drawer-foot .memory-compose { gap: .35rem; }
a.drawer-link { font-size: .85rem; min-height: 44px; display: inline-flex; align-items: center; }

/* --- The family chat --- */
/* A header that says where you are and who is in the room, with the rule
   the house runs on folded up beside it. */
.chat-head { display: flex; flex-wrap: wrap; align-items: flex-start;
  justify-content: space-between; gap: .75rem 1rem; }
.chat-title h2 { margin: 0; }
.chat-title .note { margin: .15rem 0 0; }
/* Who is at the table, as a pill rather than a sentence floating above the
   messages. The count is for a glance and the names are underneath it,
   because everywhere else in this app presence is people with names. */
/* Sticky, because the messages scroll inside #room and who is at the table
   is not something to scroll past. It stays in the live fragment rather
   than moving up into the header, so the one element the stream refreshes
   is still the one that says who is here. */
.table-presence { position: sticky; top: 0; z-index: 2;
  display: flex; align-items: center; flex-wrap: wrap;
  gap: .25rem .6rem; margin: 0 0 1rem; padding: .5rem .8rem;
  background: var(--card); border: 1px solid var(--rule); border-radius: 999px; }
.table-presence .faces { flex: none; }
.table-count { font-weight: 600; font-size: .8125rem; }
.table-who { font-size: .8125rem; color: var(--ink-soft); }
/* The day a run of messages belongs to. A thread without these is the
   undated scroll this app was written against. */
.thread-day { display: flex; align-items: center; gap: .75rem; margin: 1.5rem 0 1.1rem;
  font-size: .75rem; letter-spacing: .08em; text-transform: uppercase;
  color: var(--ink-soft); }
.thread-day::before, .thread-day::after { content: ""; flex: 1; height: 1px; background: var(--rule); }
.thread-day:first-child { margin-top: 0; }
/* What somebody said, as something said rather than a row in a list. */
.meeting-page li.thread-msg .thread-body { background: var(--paper);
  border: 1px solid var(--rule); border-radius: 14px; padding: .7rem .9rem; }
.meeting-page li.thread-msg .thread-meta { margin-top: 0; }
.meeting-page li.thread-msg[data-same-sender="true"] .thread-body { border-top-left-radius: 4px; }
/* Still in the room, on the same presence the strip above counts. */
li.thread-msg[data-here="true"] > .face { position: relative; }
li.thread-msg[data-here="true"] > .face::after {
  content: ""; position: absolute; right: -1px; bottom: -1px;
  width: .55rem; height: .55rem; border-radius: 50%;
  background: var(--sage-deep); border: 2px solid var(--paper);
}
.table-quiet { margin: 0 0 .6rem; }
/* At the table the composer is one row — say something, send it — so the
   picture disclosure goes on its own line above it rather than squeezing
   the box you type in down to nothing, which is what it did at first. */
form.say { flex-wrap: wrap; }
form.say .optional-photo { flex: 1 0 100%; order: -1; margin: 0 0 .1rem; }

/* --- A photograph on a memory --- */
/* The picture and the words are one thing, so they are one <figure>: the
   caption IS the description, which is why the image's alt is empty. */
.thing-figure { margin: 0 0 .25rem; display: grid; gap: .5rem; }
.thing-photo {
  display: block; width: auto; height: auto;
  /* The box is the picture. Sizing it to the column instead would letterbox
     every portrait photograph against a panel of empty paper, which is what
     the first version of this did. Both intrinsic dimensions are on the
     element, so the browser knows the shape before the bytes arrive and the
     card is never the wrong height. */
  max-width: 100%; max-height: 20rem;
  border-radius: .5rem;
}
.thing-figure .body { margin: 0; }
.album[data-open="true"] .thing-photo { max-height: 13rem; }
.optional-photo > summary { cursor: pointer; }
.optional-photo input[type="file"] { font-size: .8125rem; }
.optional-photo .note { margin-top: .35rem; }

/* --- The note board --- */
/* Sorted by the day each note was left, because that is the one order an
   archive of a family's days can be read in. */
.board-days { display: grid; gap: 1.3rem; }
.board-day { display: grid; gap: .65rem; }
.board-date { display: flex; align-items: baseline; gap: .6rem; margin: 0;
  font-family: var(--display); font-size: .95rem;
  padding-bottom: .35rem; border-bottom: 1px solid var(--rule); }
.board-tally { font-family: var(--body); font-size: .75rem; color: var(--ink-soft); }
.board-stamp { margin-left: auto; font-size: .72rem; color: var(--ink-soft);
  font-variant-numeric: tabular-nums; }
.board-notes { display: grid; gap: .8rem; }
.board-empty { display: grid; gap: .35rem; padding: 1.25rem 0; }

@media (max-width: 760px) {
  .drawer[data-drawer="open"] { width: 100%; height: 100%; border-radius: 0; }
  .drawer[data-drawer="open"] .drawer-inner { padding: 1rem 1.05rem .9rem; }
  /* One scroller, not two. On a wide screen the notes get their own
     scrolling area and the composer stays put under them; on a phone
     that leaves the notes about one card tall, with the form taking the
     rest of the screen — so here the whole drawer scrolls as one column
     instead, the way a phone scrolls anything. */
  .drawer[data-drawer="open"] .drawer-inner { overflow: auto; }
  .drawer[data-drawer="open"] > .drawer-inner > #room,
  .drawer[data-drawer="open"] > .drawer-inner > #board-list { overflow: visible; flex: none; }
  /* Which means the way out has to stay on screen. */
  .drawer[data-drawer="open"] .drawer-head {
    position: sticky; top: -1rem; z-index: 1;
    flex-wrap: wrap; background: var(--paper); padding-top: 1rem; margin-top: -1rem;
  }
  .drawer-words { flex: 1 1 10rem; }
  .drawer-close:not([hidden]) { order: 3; width: 100%; margin-left: 0; justify-content: center; }
}

@media (prefers-reduced-motion: no-preference) {
  a.house-card { transition: transform .15s ease; }
  .drawer[data-drawer="open"] { animation: drawer-out .3s cubic-bezier(.2,.75,.3,1); }
  @keyframes drawer-out {
    from { opacity: 0; transform: translateY(14px) scale(.985); }
    to { opacity: 1; transform: none; }
  }
  a.house-card:hover { transform: translateY(-2px); }
  .float-card { transition: transform .15s ease, border-color .15s ease; }
  .float-card:hover { transform: translateY(-2px); }
}
${DESIGN_STYLE}
`;

/** Which nav link is the page you are on, so it can be marked. Pages that
 *  aren't one of the three (the README, a household room) pass nothing and
 *  no link is marked, which is honest — none of them is where you are. */
export type NavKey = "map" | "shelf" | "meeting" | "signin";

/** The words after your name at the top of every page: which house is
 *  yours, or that none is. A guest is told so plainly rather than left to
 *  work it out from a composer that isn't there — being told the rule
 *  teaches it, and the app refuses nothing silently. */
function whereYouLive(me: Person): string {
  if (!me.memberName) return "";
  const household = householdOf(me.memberName);
  if (!household) return ", a guest in every house";
  const house = houseBySlug(household);
  return house ? `, and ${esc(house.name)} is yours` : "";
}

export function page(
  title: string,
  inner: string,
  me?: Person | null,
  active?: NavKey,
): string {
  const link = (href: string, key: NavKey, label: string): string =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ""}${key === "meeting" ? ' aria-label="The meeting house"' : ""}>${key === "meeting" ? '<span class="nav-full">The meeting house</span><span class="nav-short" aria-hidden="true">Meeting room</span>' : label}</a>`;
  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${FONTS_HEAD}
<title>${esc(title)}</title><style>${STYLE}</style>
</head><body>
<header class="chrome">
  <a class="brand" href="/">The village</a>
  <nav class="site" aria-label="site">
    ${link("/", "map", "Village map")}
    ${link("/shelf", "shelf", "Memory shelf")}
    ${link("/house/meeting", "meeting", "The meeting house")}
    ${
      // Offered to anybody not signed in. The last version of this link was
      // the bug: /key answered 200 from its first commit and nothing pointed
      // at it, so the only way to reach it was to type the URL.
      me?.memberName ? "" : link("/login", "signin", "Sign in")
    }
    <form class="leave" method="post" action="/leave"><button type="submit" aria-label="Leave the village"><span class="nav-full">Leave the village</span><span class="nav-short" aria-hidden="true">Leave</span></button></form>
  </nav>
  ${
    me
      ? `<p class="whoami">You are <strong>${esc(displayName(me))}</strong>${
          // Say which house is yours, or that none is. Somebody refused at a
          // home should be able to see why from the top of the page rather
          // than infer it from a missing form.
          whereYouLive(me)
        } ${face(me.name)}</p>`
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
/** A memory's photograph, with the memory's own words as its caption.
 *
 *  `alt` is empty on purpose, and that is the accessible answer rather than
 *  a lapse: the app has no idea what is in the picture, and a description
 *  it invented would be exactly the false label the house pictures are
 *  careful not to be. An empty alt inside a <figure> says "the caption is
 *  the description", and the caption is what the person who was there
 *  actually wrote.
 *
 *  Width and height come out of the file name, which carries the size the
 *  bytes themselves reported — so the card is the right height before the
 *  picture arrives and nothing on the page jumps.
 */
function bodyWithPhoto(t: ThingView): string {
  const words = `<p class="body">${esc(t.body)}</p>`;
  if (!t.photo) return words;
  const size = sizeOfName(t.photo);
  const dims = size ? ` width="${size.w}" height="${size.h}"` : "";
  return `<figure class="thing-figure">
    <img class="thing-photo" src="/photo/${esc(t.photo)}"${dims} alt="" loading="lazy" decoding="async">
    <figcaption class="body">${esc(t.body)}</figcaption>
  </figure>`;
}

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
    ${bodyWithPhoto(t)}
    ${dateMeta(t)}
    ${stateRow(t)}
    ${perspectivesList(t)}
    <details class="memory-actions"><summary>${t.isOwn ? "About this note" : t.viewerHasKept ? "Kept together" : "Add your perspective"}</summary>${actionArea(t, houseSlug)}</details>
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
    // "Nothing today", not "nothing in this room": what the table is empty
    // of is today, and everything older is on the board a link away. Saying
    // the room was empty would be false the moment anybody had ever used it.
    return `${who}<div class="room-empty"><svg viewBox="0 0 36 44" width="36" height="44" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M7 4h17l6 6v29H7zM23 4v8h7M12 20h12M12 25h12M12 30h7"/></svg><div><p class="hand">A clear table.</p><p class="note">Nothing has been put down here today. Leave a note; someone can add their own perspective and keep it together.</p><a href="#compose">Write today's first note →</a></div></div>`;
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
  // Past a week, the date rather than a count of days — but the DATE, not
  // the timestamp. This used to print the stored value whole, so a message
  // in the thread read "2026-11-01 16:17:27 UTC" beside another reading
  // "4d ago". The seconds are precision nobody asked for and nobody can
  // use; the day is the fact. Still no guessing, and still UTC.
  return longDate(iso.slice(0, 10));
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

/** `sameSender` groups a run of messages from one person: the monogram and
 *  name show once for the run, the rest tuck under it. Decided here rather
 *  than in CSS because `:has()` on a previous sibling does not exist, and
 *  the server already knows who said what. */
function threadMessage(
  t: ThingView,
  houseSlug: string,
  sameSender = false,
  /** Everybody else the room can see right now. Used for one thing: a dot
   *  on the speaker's monogram when they are still in the room. It is the
   *  same presence the strip above the thread counts, so the dot cannot
   *  disagree with the sentence. */
  here: ReadonlySet<string> = new Set(),
): string {
  const present = here.has(t.placedByName);
  return `<li class="thing thread-msg" data-same-sender="${sameSender}" data-here="${present}">
    ${monogram(t.placedByName)}
    <div class="thread-body">
      <p class="thread-meta"><strong>${esc(t.placedByName)}</strong> ${homeChip(t.placedBy)}
        <span class="thread-time">${esc(timeAgo(t.createdAt))}</span></p>
            ${titleLine(t)}
      ${bodyWithPhoto(t)}
      ${eventAndKeptMeta(t)}
      ${stateRow(t)}
      ${perspectivesList(t)}
      <details class="message-actions"><summary>${t.isOwn ? "About this message" : t.viewerHasKept ? "Kept together" : "Add to this memory"}</summary>${actionArea(t, houseSlug)}</details>
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
function threadFragment(
  otherNames: string[],
  things: ThingView[],
  houseSlug: string,
  now: string,
): string {
  // The presence strip is a count AND the names. The count is what a glance
  // wants; the names are what the rest of the app says, and dropping them
  // for a tidier pill would make this the one place the village talks about
  // "3 people" instead of about Mum and Anh. The viewer is counted, because
  // they are at the table — they are reading it.
  const atTable = otherNames.length + 1;
  const strip = `<p class="table-presence" id="who">
    ${faces(otherNames)}
    <span class="table-count">${atTable} at the table</span>
    <span class="table-who">${
      otherNames.length
        ? `${names(otherNames)} ${otherNames.length === 1 ? "is" : "are"} here with you`
        : "Just you, for now"
    }</span>
  </p>`;
  if (!things.length) {
    return `${strip}<div class="conversation-empty"><svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M13 15h38v27H31L19 51v-9h-6z"/><circle cx="23" cy="29" r="1"/><circle cx="32" cy="29" r="1"/><circle cx="41" cy="29" r="1"/></svg><p class="hand">Pull up a chair.</p><p class="empty">Nothing has been said at the table yet.</p><p class="note">Leave a little of your day for whoever comes by.</p></div>`;
  }
  const here = new Set(otherNames);
  const oldestFirst = [...things].reverse();
  // A day divider wherever the day changes. A thread two hundred messages
  // long is otherwise one undated scroll, which is the group chat this app
  // was written against: An Duy's first year is in there somewhere and
  // nobody will find it. The labels come from the same `dayLabel` the note
  // board uses, so "Today" means the same thing in both places.
  const rows: string[] = [];
  let day = "";
  oldestFirst.forEach((t, i) => {
    const its = t.createdAt.slice(0, 10);
    if (its !== day) {
      day = its;

    }
    const sameSender =
      i > 0 && oldestFirst[i - 1]!.placedBy === t.placedBy && oldestFirst[i - 1]!.createdAt.slice(0, 10) === its;
    rows.push(threadMessage(t, houseSlug, sameSender, here));
  });
  return `${strip}<ol class="thread">${rows.join("")}</ol>`;
}

/** The village's one room-list renderer, with the meeting house's single
 *  exception: it alone reads as a conversation (see `threadFragment`).
 *  Every other house keeps the plain room list this always rendered. */
export function roomFragment(
  otherNames: string[],
  things: ThingView[],
  houseSlug: string,
  /** Today, UTC, from `today()` in src/things.ts. Passed in rather than read
   *  here so that one function answers which day it is — the five-a-day
   *  count, the note board and the thread's dividers all ask the same one,
   *  and a renderer that asked the clock itself could label a message
   *  "Today" that the server had already counted as yesterday. */
  now: string,
): string {
  return houseSlug === "meeting"
    ? threadFragment(otherNames, things, houseSlug, now)
    : regularRoomFragment(otherNames, things, houseSlug);
}

export function loginPage(message: string | null): string {
  return page(
    "The village",
    `<main class="measured join-page">
      <span class="eyebrow">Four places. One family.</span>
      <h1>The village</h1>
      <p class="lede">Four places and the people in them. Sign in to go in.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/login">
        <label for="name">Your name</label>
        <input id="name" name="name" required maxlength="40" autocomplete="username">
        <label for="password">Your password</label>
        <input id="password" name="password" type="password" required autocomplete="current-password">
        <button class="primary">Sign in</button>
      </form>
      <p class="note">No account yet? <a href="/register">Make one</a>.</p>
    </main>`,
  );
}

/** Registering. The household select carries a "just visiting" option as its
 *  first entry, so belonging to no house is something you can choose rather
 *  than something that happens when you leave a field alone.
 *
 *  `chosen` keeps the household picked across a refusal, so somebody told
 *  their code was wrong does not have to find their house in the list again. */
export function registerPage(
  houses: House[],
  message: string | null,
  chosen: string | null,
): string {
  const options = houses
    .filter((h) => h.kind === "home")
    .map(
      (h) =>
        `<option value="${esc(h.slug)}"${chosen === h.slug ? " selected" : ""}>${esc(h.name)}</option>`,
    )
    .join("");
  return page(
    "Join the village",
    `<main class="measured join-page">
      <span class="eyebrow">Four places. One family.</span>
      <h1>Join the village</h1>
      <p class="lede">A name, a password, and where you live. The app keeps
        those three things and nothing else — no email, no profile, nothing
        to recover.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/register">
        <label for="name">What should everyone call you?</label>
        <input id="name" name="name" required maxlength="40" placeholder="An" autocomplete="username">

        <label for="password">A password</label>
        <input id="password" name="password" type="password" required minlength="8" autocomplete="new-password">
        <p class="note">Eight characters or more. There is no way to reset it,
          because resetting one needs somewhere to send it and this app has
          no addresses.</p>

        <label for="household">Which house is yours?</label>
        <select id="household" name="household">
          <option value=""${chosen === null ? " selected" : ""}>Just visiting — no house is mine</option>
          ${options}
        </select>

        <label for="code">Your household's code</label>
        <input id="code" name="code" type="password" autocomplete="off">
        <p class="note">Only needed to claim a house. Leave it blank to visit:
          you can still look around every house, write your side of anything
          you find, and keep things together with whoever put them down.</p>

        <button class="primary">Create account</button>
      </form>
      <p class="note">Already have an account? <a href="/login">Sign in</a>.</p>
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
          <span class="float-text">
            <span class="float-name">${esc(h.name)}</span>
            <span class="float-meta">${faces(h.hereNames)}<span>${esc(presence)}${yours}<br>${h.counts.onShelf} kept memories</span></span>
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
        <p class="scene-sub">Four homes, one shared story. Put down what you’re carrying, see what others
          have left, and feel a little closer — wherever you are.</p>
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
    const pebbles = `<span class="pit-stones" aria-hidden="true">${Array.from({ length: Math.min(pit.dan, 9) }, () => '<span class="stone"></span>').join("")}</span>`;
    const inner = `${pit.quan ? '<span class="quan-stone" aria-hidden="true">10</span>' : ""}${pebbles}<span class="pit-count${pit.quan && !pit.dan ? " count-on-quan" : ""}">${esc(label)}</span>${isQuanPit(i) ? '<span class="quan-label" aria-hidden="true">QUAN</span>' : ""}
      <span class="visually-hidden">${
        pit.quan > 0
          ? `a quan and ${pit.dan} ${pit.dan === 1 ? "stone" : "stones"}`
          : `${pit.dan} ${pit.dan === 1 ? "stone" : "stones"}`
      }</span>`;
    const quanClass = isQuanPit(i) ? " pit-quan" : "";
    if (!selectable.has(i)) {
      return `<li class="pit${quanClass}" data-pit="${i}" data-stones="${stones}">${inner}</li>`;
    }
    const href = isPicked(i)
      ? `/house/${esc(houseSlug)}`
      : `/house/${esc(houseSlug)}?pit=${i}`;
    return `<li class="pit${quanClass}" data-pit="${i}" data-stones="${stones}">
      <a class="pit-pick" href="${href}" aria-label="Pick pit ${i} · ${pit.dan} stones"${isPicked(i) ? ' aria-current="true"' : ""}>
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
    <div class="move-guidance"><p class="hand">${g.ended ? "The final position, kept as it was played." : picked !== null && selectable.has(picked) ? `You picked ${g.board[picked].dan} stones. Which way?` : g.yourTurn ? "Start with a handful of stones." : "A little patience. A little strategy."}</p>
    <p class="note">${selectable.size ? "Choose one of your pits, then sow left or right." : "Small stone (dân) = 1 point · Large stone (quan) = 10 points"}</p>${directions}</div>
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

/** A vector cover for the one game this app actually supports. */
function gameIllustration(): string {
  const pits = [0, 1].flatMap(row => Array.from({ length: 5 }, (_, i) => {
    const x = 56 + i * 48;
    const y = 32 + row * 60;
    const stones = [[12, 15], [28, 12], [21, 28], [10, 39], [31, 37]]
      .map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="3.6" ry="3"/>`).join("");
    return `<rect class="cover-pit" x="${x}" y="${y}" width="43" height="55" rx="5"/>${stones}`;
  })).join("");
  return `<svg class="game-illustration" viewBox="0 0 352 184" width="352" height="184" aria-hidden="true"><rect class="cover-board" x="8" y="18" width="336" height="148" rx="74"/>${pits}<path class="cover-end" d="M48 34a58 58 0 0 0 0 116zm256 0a58 58 0 0 1 0 116z"/><ellipse class="cover-quan" cx="31" cy="92" rx="10" ry="13"/><ellipse class="cover-quan" cx="321" cy="92" rx="10" ry="13"/></svg>`;
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
    return `<div class="card game-invitation">
      <div class="game-invitation-copy"><span class="eyebrow">A game for two</span>
      <h2 class="rule-title">Ô ăn quan</h2>
      <p class="body-sm">Five little stones. A familiar way to spend time together.</p>
      <p class="game-facts">2 players <span aria-hidden="true">·</span> No timer <span aria-hidden="true">·</span> Learn as you play</p>
      ${past}
      ${keep}
      <form method="post" action="/game/sit">
        <input type="hidden" name="house" value="${esc(houseSlug)}">
        <button class="primary">Set out a board <span aria-hidden="true">→</span></button>
      </form></div>${gameIllustration()}
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
    // A chair whose player has left the room. Anybody may free it — the
    // person who would normally stand up is, by definition, not here to.
    // Without this the table stayed "2 seated · 1 here" for ever and no
    // game could be started at it again.
    const away = side === "bottom" ? !g.bottomHere : !g.topHere;
    const freeForm = away
      ? `<form method="post" action="/game/free" class="chair-free">
          <input type="hidden" name="house" value="${esc(houseSlug)}">
          <input type="hidden" name="side" value="${side}">
          <button>Free this chair</button>
        </form>`
      : "";
    return `<li class="chair" data-turn="${!g.ended && g.turn === side && Boolean(g.top)}" data-yours="${g.yourSide === side}" data-away="${away}">
      ${face(name)}
      <span class="chair-name">${esc(name)}<small>${esc(yours)}${esc(toMove)}${away ? " · away" : ""}</small></span>
      <span class="chair-score">${score}<small>points</small></span>
      ${freeForm}
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
    <div class="game-title-row"><div><span class="eyebrow">At the table</span><h2 class="rule-title">Ô ăn quan</h2></div>
    <p class="game-attendance">${g.top ? "2 seated" : "1 waiting"}<span aria-hidden="true"> · </span>${watching + 1} here</p></div>
    <ul class="chairs">${chair("bottom")}${chair("top")}</ul>
    <p class="game-legend"><span><i class="legend-dan" aria-hidden="true"></i>Dân <strong>1</strong></span><span><i class="legend-quan" aria-hidden="true"></i>Quan <strong>10</strong></span><span>No timer</span></p>
    ${action ? `<details class="game-options"><summary>Table options</summary><div>${action}</div></details>` : ""}
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
      <h3>How to play Ô ăn quan</h3>
      <p class="rules-legend">2 players · Dân 1 point · Quan 10 points · No timer</p>
      <p class="lede">Collect the most points by sowing and capturing stones.</p>
      ${rule("01", "Set the table", "Ten small pits start with five dân each; the two end pits hold one quan each. You own the five small pits nearest you.")}
      ${rule("02", "Sow your stones", "Pick a non-empty small pit on your side. Sow all its stones, one per pit, left or right around the whole board, including both quan pits.")}
      ${rule("03", "Keep going — or stop", "After your last drop, look at the next pit. An occupied small pit: pick it up and keep sowing the same way. An occupied quan pit, or two empty pits: stop.")}
      ${rule("04", "Capture across a gap", "If the next pit is empty and the one beyond it holds stones, capture that second pit. Repeat across further empty-then-occupied pairs, then end your turn.")}
      <div class="capture-example"><span>Last drop</span><span class="example-pit">Empty pit</span><span aria-hidden="true">→</span><span class="example-pit example-capture">4 stones</span><strong>Capture all 4</strong></div>
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
  /** The move just played, one beat per stone, for the script to replay.
   *  The board below is already drawn in its true final position — this
   *  only says how it got there, and with no script it is ignored. */
  replay?: { pit: number; direction: string; side: string; drops: unknown[] } | null,
): string {
  // A <script type="application/json"> is inert: not executed, not a
  // dangling global, and simply ignored when scripts are blocked. The
  // board's own markup stays the single source of the position.
  const replayData =
    replay && replay.drops.length
      ? `<script type="application/json" id="sow-replay">${JSON.stringify(replay).replace(/</g, "\\u003c")}</script>`
      : "";
  return `${replayData}<div class="table-side">${tablePanel(game, houseSlug, othersHere)}</div>
    <div class="table-board">
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
    </div>`;
}

/** What actually moves a thing to the shelf: never presence alone, always a
 *  distinct second member writing their own perspective and choosing to
 *  keep it together. Presence names are still shown, since who is around is
 *  still useful to know — just not framed as the cause. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A day on the note board, in words. "Today" and "Yesterday" are worth
 *  saying because they are how anybody would say them; everything older
 *  gets its real date rather than "4 days ago", because a board is sorted
 *  by date and a relative age is not a date you can look down a list for.
 *
 *  `now` is passed in rather than read from the clock here, so that every
 *  heading on one board is relative to the SAME day — a board rendered
 *  across midnight would otherwise be able to say "Today" twice. */
/** A YYYY-MM-DD in words. Shared by the note board's headings and by
 *  anything in `timeAgo` older than a week, so one date is written one way
 *  everywhere in the app. */
function longDate(day: string): string {
  const [y, m, d] = day.split("-");
  const month = MONTHS[Number(m) - 1];
  return month ? `${Number(d)} ${month} ${y}` : day;
}

function dayLabel(day: string, now: string): string {
  if (day === now) return "Today";
  const then = Date.parse(`${day}T00:00:00Z`);
  const here = Date.parse(`${now}T00:00:00Z`);
  if (here - then === 86_400_000) return "Yesterday";
  return longDate(day);
}

const noteCount = (n: number): string => (n === 1 ? "1 note" : `${n} notes`);

/** The note board: every note this room holds, under the day it was left.
 *
 *  Exported because it has a fragment route of its own — see /house/:slug/board
 *  — and the live stream swaps it the same way it swaps the table. One
 *  renderer either way, so a board that updated live could never show
 *  something a reloaded one would not.
 *
 *  A note renders here as the same `li.thing` the table shows, deliberately:
 *  a note on the board and a note on the table are one object seen in two
 *  places, and the perspective and keep-together controls have to work on
 *  the board too, or a note older than today could never reach the shelf. */
export function boardFragment(days: NoteDay[], houseSlug: string, now: string): string {
  if (!days.length) {
    return `<div class="board-empty"><p class="hand">Nothing on the board yet.</p>
      <p class="note">Every note left in this room ends up here, under the day it was left. Put the first one on the table.</p></div>`;
  }
  const label = (day: string): string => dayLabel(day, now);
  const items = days
    .map(
      (d) => `<li class="board-day">
        <h3 class="board-date"><span class="board-when">${esc(label(d.day))}</span>
          <span class="board-tally">${esc(noteCount(d.things.length))}</span>
          ${
            // "Today" and "Yesterday" are how anybody says those two days,
            // but a board is sorted BY date, so the date itself is printed
            // beside them. For every older day the heading already is the
            // date and repeating it would just be the same thing twice.
            label(d.day) === d.day || !/^(Today|Yesterday)$/.test(label(d.day))
              ? ""
              : `<span class="board-stamp">${esc(d.day)}</span>`
          }</h3>
        <ol class="board-notes">${d.things.map((t) => thingItem(t, houseSlug)).join("")}</ol>
      </li>`,
    )
    .join("");
  return `<ol class="board-days">${items}</ol>`;
}

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
  table?: { game: GameView | null; picked: number | null; replay?: { pit: number; direction: string; side: string; drops: unknown[] } | null },
  /** The three household houses only: the note board behind the table, and
   *  how many notes this viewer may still leave on the table today. The
   *  meeting house has neither — nothing is capped there and a remark is
   *  not a note on a surface — so it carries on passing nothing. */
    notes?: { days: NoteDay[]; left: number; today: string },
  /** Today, UTC, from `today()` in src/things.ts — see roomFragment. The
   *  three homes also get it inside `notes`; the meeting house has no note
   *  board and still needs it for the thread's day dividers. */
  now: string = "",
): string {
  const isMeeting = house.slug === "meeting";
  // The same rule the route uses, asked again here so the page offers only
  // what the server would accept. Derived rather than passed in, so a caller
  // cannot render a composer the route would refuse.
  const mayPutDown = mayPlace(house.kind, me.memberName ? householdOf(me.memberName) : null, house.slug);
  const composeLabel = isMeeting ? "What do you want to say at the table?" : "What do you want to put down here?";
  // "Send" at the table, because that is the word for saying something to a
  // room. "Put this down" stays in the houses, where the verb really is
  // placing an object somewhere it will stay.
  const composeButton = isMeeting ? "Send" : "Put this down";
  const quietLine = isMeeting
    ? "Whatever is said here reaches everyone in the room. No alerts, no unread marks."
    : "No notifications, no alerts. You find out by visiting.";

  // The composer, built once and placed differently by house: under the
  // messages at the table, in the side panel everywhere else. Same form
  // either way — a plain POST to /place that works with JavaScript off.
  const composerBlock = mayPutDown
    ? `<form method="post" action="/place" id="compose" enctype="multipart/form-data" class="${isMeeting ? "say" : "memory-compose"}">
            ${isMeeting ? "" : '<h3>Add a note to the table</h3>'}
            <input type="hidden" name="house" value="${esc(house.slug)}">
            ${
              isMeeting
                ? ""
                : `<label for="title">Give it a title</label>
            <input id="title" name="title" required maxlength="120" placeholder="His first steps">`
            }
            <label for="body"${isMeeting ? ' class="visually-hidden"' : ""}>${esc(composeLabel)}</label>
            ${isMeeting ? '<input id="body" name="body" required maxlength="280" placeholder="Share a thought with the room…" autocomplete="off">' : '<textarea id="body" name="body" required maxlength="280" rows="4" placeholder="What do you want to remember?"></textarea>'}
                        ${
              isMeeting
                ? ""
                : `<details class="optional-date"><summary>Add a date <span class="note">(optional)</span></summary><label for="event_date">When did this happen?</label>
            <input id="event_date" name="event_date" maxlength="40" placeholder="March 2019, or any time you like"></details>`
            }
            <details class="optional-photo"><summary>Add a picture <span class="note">(optional)</span></summary>
            <label for="photo">One photograph, up to four megabytes</label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp">
            <p class="note">It goes with these words and stays with them. There is no album of pictures on their own.</p></details>
            <button class="primary">${esc(composeButton)}</button>
          </form>`
    : "";

  // Where "Alice is typing" appears. Empty and aria-live, so a screen
  // reader announces it when it fills and says nothing the rest of the
  // time. With JavaScript off it stays empty forever, which is exactly
  // right: nothing is sending.
  const typingLine = isMeeting
    ? `<p id="typing" class="typing" role="status" aria-live="polite"></p>`
    : "";
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
  // "Was the reader already at the newest message?" — asked of whichever
  // thing is actually scrolling. The messages now scroll inside #room on a
  // wide screen, and the document still scrolls on a narrow one where that
  // cap is lifted. Measuring the document either way would report
  // "near the bottom" for a reader scrolled up through old messages in a
  // short page, and yank them back down on every arrival.
  const nearBottomCheck = isMeeting
    ? `const scroller = room.scrollHeight > room.clientHeight ? room : document.documentElement;
          const wasNearBottom = scroller === room
            ? (room.scrollTop + room.clientHeight) >= (room.scrollHeight - 200)
            : (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 200);`
    : "";
  const scrollAfterSwap = isMeeting ? "\n            if (wasNearBottom) scrollToNewestMessage();" : "";
  // A chat opens at the newest message, not the oldest. Only meaningful
  // once the messages have their own scroller; on a narrow screen the
  // page is already at the top and jumping would hide the room's heading.
  const scrollOnLoad = isMeeting
    ? `if (room.scrollHeight > room.clientHeight) room.scrollTop = room.scrollHeight;`
    : "";

  // --- The room, as furniture ---
  //
  // A household room shows no notes and no memories on its own floor any
  // more. It shows what a room shows: a table and a shelf. The notes are on
  // the table and the album is on the shelf, and you look at either by
  // going to it.
  //
  // Both are ordinary links. The shelf's goes to this house's album, which
  // is a page that already exists; the table's points at the drawer below,
  // which with no script is simply open under the room. So the furniture
  // does what it looks like it does whether or not any of the script
  // arrives — see the comment on the drawers themselves.
  const TABLE_ART =
    '<svg viewBox="0 0 32 24" width="29" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 11h28M6 11v11M26 11v11M11 11V4h10v7"/></svg>';
  const SHELF_ART =
    '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5Q6 2 3 5v15q5-3 9 0 4-3 9 0V5q-3-3-9 0zM12 5v15"/></svg>';
  // How much room is left on the table today. Everybody's, because the
  // table is everybody's — so unlike a per-person count this one CAN go
  // out of date while the page is open, if somebody in the same house
  // leaves a note. It is inside the drawer, which the live stream
  // refreshes on every event, and the count rides along with it.
  const leftToday = notes?.left ?? NOTES_A_DAY;
  const leftLine = !mayPutDown
    ? "Read what is here, add your side"
    : leftToday === 0
      ? "Full for today — five is what it holds"
      : leftToday === 1
        ? "Room for one more today"
        : `Room for ${leftToday} more today`;
  const onTableNow = things.length === 1 ? "1 note today" : `${things.length} notes today`;
  const boardTotal = (notes?.days ?? []).reduce((n, d) => n + d.things.length, 0);
  const furniture = `<div class="room-furniture">
        <a class="furniture furniture-table" href="#table">
          <span class="furniture-art">${TABLE_ART}</span>
          <span class="furniture-words"><strong>The table</strong><small>${esc(onTableNow)}</small></span>
          <span class="furniture-go" aria-hidden="true">›</span>
        </a>
        <a class="furniture furniture-shelf" href="/shelf?house=${esc(house.slug)}">
          <span class="furniture-art">${SHELF_ART}</span>
          <span class="furniture-words"><strong>The shelf</strong><small>The album, kept together</small></span>
          <span class="furniture-go" aria-hidden="true">›</span>
        </a>
      </div>`;

  // What the table offers you once you are at it: the form, or the words
  // saying why there isn't one. A guest has no form here at all and never
  // did; somebody who has already left five has used the table up for
  // today. Both are told the rule rather than shown a control that would
  // be refused.
  const tableFoot = !mayPutDown
    ? `<p class="body-sm">You're a guest in this house, so starting something new here is for the people who live in it. You can still write your side of anything on this table or on the board and keep it together — that's how it reaches their shelf.</p>`
    : leftToday === 0
      ? `<p class="body-sm"><strong>This table has its five for today.</strong> That's what it holds in a day, whoever leaves them — it's a surface, not storage. They're all on the note board, and tomorrow's table starts empty. Writing your side of something already here, and keeping it together, are never capped.</p>`
      : composerBlock;

  // --- The drawers ---
  //
  // Each is a <dialog>, which is an ordinary open block until something
  // calls showModal() on it. Nothing does unless the script runs, and the
  // FIRST thing the script does is shut them — so a script that fails to
  // parse leaves the room exactly as the server sent it: the table open
  // under the scene with today's notes in it, the board open under that
  // with every note the room holds. Nothing is ever only behind a click.
  // The two-state rule and what follows from it. Not a note and not a
  // memory, so it stays in the room rather than going in a drawer.
  const guideBlock = `<details class="memory-guide">
            <summary>How memories are kept</summary>
            <div class="card">
              <h3 class="rule-title">The two-state rule</h3>
              <p class="body-sm"><strong>In the room</strong> — nobody has kept this together yet.</p>
              <p class="body-sm"><strong>On the shelf</strong> — someone wrote their own perspective and chose to keep it together, and it stays.</p>
            </div>
            <div class="card-raised">
              <p class="consequence">${esc(consequenceLine(otherNames))}</p>
            </div>
          </details>`;

  const drawers = isMeeting
    ? ""
    : `<dialog class="drawer" id="table" aria-labelledby="table-title">
        <div class="drawer-inner">
          <div class="drawer-head">
            <span class="drawer-art" aria-hidden="true">${TABLE_ART}</span>
            <span class="drawer-words"><h2 id="table-title">The table</h2><small>${esc(leftLine)}</small></span>
            <button type="button" class="drawer-close" hidden autofocus>Leave the table</button>
          </div>
          <div id="room">${roomFragment(otherNames, things, house.slug, now)}</div>
          <div class="drawer-foot">
            ${tableFoot}
            <a class="drawer-link" href="#board">The note board — ${esc(
              boardTotal === 1 ? "1 note, by the day it was left" : `all ${boardTotal} notes, by the day they were left`,
            )} →</a>
          </div>
        </div>
      </dialog>
      <dialog class="drawer drawer-board" id="board" aria-labelledby="board-title">
        <div class="drawer-inner">
          <div class="drawer-head">
            <span class="drawer-art" aria-hidden="true"><svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4h16v16H4zM4 9h16M9 9v11"/></svg></span>
            <span class="drawer-words"><h2 id="board-title">The note board</h2><small>Every note this room has held, newest day first</small></span>
            <button type="button" class="drawer-close" hidden autofocus>Close the board</button>
          </div>
          <div id="board-list">${boardFragment(notes?.days ?? [], house.slug, notes?.today ?? "")}</div>
          <div class="drawer-foot">
            <a class="drawer-link" href="#table">← Back to the table</a>
          </div>
        </div>
      </dialog>`;
  return page(
    house.name,
    `<main class="house-page ${isMeeting ? "meeting-page" : "home-page"}">
      ${roomScene(
        house.slug,
        `<a class="scene-back" href="/">← Back to the village</a>
        <span class="scene-eyebrow">${isMeeting ? "The meeting house" : "A place to leave a little of your day"}</span>
        <h1>${isMeeting ? '<span class="meeting-name">The meeting house</span><span class="meeting-welcome" aria-hidden="true">Together feels<br>different here.</span>' : esc(house.name)}</h1>
        <p class="lede">${isMeeting ? "Games, stories, and good company — wherever we are." : "A place for our family memories, across distance."}</p>
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
        isMeeting ? "" : furniture,
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
              table.replay,
            )}</section>`
          : ""
      }
      ${
        // The meeting house is unchanged: it is a conversation, and the
        // messages are the room. Hiding a group chat behind a piece of
        // furniture would undo the argument the README makes for its
        // shape — that the chat's shape was borrowed on purpose and only
        // its ending is different.
        isMeeting
          ? `<div class="layout-house measured">
                <div class="room-collection conversation">
          <div class="chat-head">
            <div class="chat-title">
              <h2>Family chat</h2>
              <p class="note">Everyone, wherever they are</p>
            </div>
            ${guideBlock}
          </div>
          ${
            // The brief's first artefact criterion is the keyboard, and the
            // message box is the LAST thing in the tab order here: every
            // message carries a disclosure control, so at two hundred
            // messages the box was stop 606 of 609. Hidden until focused,
            // the way a skip-to-content link is, so it costs a sighted
            // mouse user nothing and a keyboard user one stop.
            mayPutDown ? `<a class="skip-to-composer" href="#body">Skip to the message box</a>` : ""
          }
          <div id="room">${roomFragment(otherNames, things, house.slug, now)}</div>
                    ${
            // At the table the composer belongs UNDER what was said, where
            // a conversation puts it, not in the side panel beside it. The
            // quiet line sits between the two, which is where it is read:
            // it is about what happens when you press send.
            `<div class="composer"><p class="quiet table-quiet">${esc(quietLine)}</p>${composerBlock}${typingLine}</div>`
          }
        </div>
      </div>`
          : // A household room keeps only what is not a note and not a
            // memory: the rule the house runs on, and the line about there
            // being no notifications. Everything anybody put down is on the
            // table or on the board below.
            `<div class="layout-house measured room-only">
        <div class="panel-stack">
          ${guideBlock}
          <p class="quiet">${esc(quietLine)}</p>
        </div>
      </div>
      ${drawers}`
      }
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          const rules = document.querySelector("details.rules[open]");
          if (rules) { rules.removeAttribute("open"); rules.querySelector("summary")?.focus(); }
        });
        // Null in the three household houses, which have no game table.
        // Asked for by name only where one can exist: a household room now
        // has a <dialog id="table"> of its own — the drawer the notes are
        // in — and handing that to the board's resync would have it fetch
        // a fragment route that house hasn't got.
        const table = ${isMeeting ? 'document.getElementById("table")' : "null"};

        // --- The furniture ---
        //
        // Everything in the drawers is already readable without a line of
        // this: both render open under the room, and the table and the
        // board are plain links down to them. So the FIRST thing done here
        // is shut them — which means a script that fails to parse hides
        // nothing at all, and the room stays the complete list the server
        // sent. The failure mode is the no-script mode.
        const drawers = new Map();
        for (const d of document.querySelectorAll("dialog.drawer")) {
          // A browser with no <dialog> keeps the open drawers it was sent,
          // rather than being handed furniture that will not open.
          if (typeof d.showModal === "function") drawers.set(d.id, d);
        }
        if (drawers.size) {
          let cameFrom = null;
          // Going from the table to the board shuts one and opens the
          // other. The scroll lock and the focus belong to the pair, not
          // to either one, so the handover says so.
          let switching = false;
          for (const d of drawers.values()) {
            d.setAttribute("data-drawer", "shut");
            const close = d.querySelector(".drawer-close");
            if (close) {
              close.hidden = false;
              close.addEventListener("click", () => d.close());
            }
            // The room behind is still the room: clicking it shuts the
            // drawer, the same way clicking off an open book shuts it.
            d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
            d.addEventListener("close", () => {
              d.setAttribute("data-drawer", "shut");
              if (switching) return;
              document.documentElement.style.overflow = "";
              if (cameFrom) { cameFrom.focus(); cameFrom = null; }
            });
          }
          const openDrawer = (id, from) => {
            const d = drawers.get(id);
            if (!d) return;
            if (from) cameFrom = from;
            switching = true;
            for (const other of drawers.values()) if (other !== d && other.open) other.close();
            switching = false;
            d.setAttribute("data-drawer", "open");
            d.showModal();
            document.documentElement.style.overflow = "hidden";
          };
          // Every link that pointed at a drawer now opens it instead of
          // jumping down to it. The links are what work with no script, so
          // they are what works with one too — there is no second set of
          // controls that only a script can reach.
          for (const link of document.querySelectorAll('a[href^="#"]')) {
            const id = (link.getAttribute("href") || "").slice(1);
            if (!drawers.has(id)) continue;
            link.addEventListener("click", (e) => {
              e.preventDefault();
              // A link from inside one drawer to the other leaves the
              // piece of furniture in the ROOM as the thing focus comes
              // back to, because that is where the reader started.
              openDrawer(id, link.closest("dialog.drawer") ? null : link);
            });
          }
          // Arriving on /house/x#table — a bookmark, or a reload after
          // opening one — should still put you at the table, not at a
          // drawer the script has just shut behind you.
          if (location.hash.length > 1) openDrawer(location.hash.slice(1), null);
        }
        ${scrollHelper}
        ${scrollOnLoad}
        const stream = new EventSource("/stream?house=" + encodeURIComponent(${JSON.stringify(house.slug)}));
        const slug = encodeURIComponent(${JSON.stringify(house.slug)});
        const swap = async (el, path) => {
          const res = await fetch("/house/" + slug + path, { headers: { accept: "text/html" } });
          if (res.ok) {
            const openRules = el.querySelector("details.rules[open]") !== null;
            const openOptions = el.querySelector("details.game-options[open]") !== null;
            el.innerHTML = await res.text();
            if (openRules) el.querySelector("details.rules")?.setAttribute("open", "");
            if (openOptions) el.querySelector("details.game-options")?.setAttribute("open", "");
          }
          return res.ok;
        };
        // Sowing, stone by stone. CLAUDE.md's second JavaScript exception:
        // the board below is ALREADY in its true final position, drawn by
        // the server, so with a script blocked the position is simply
        // correct at once and nothing travels. This only retells how it
        // got there.
        //
        // It never computes a position. Every beat comes from the server's
        // own replay of the move it recorded, so the animation cannot
        // disagree with the game.
        // Guarded: a browser without matchMedia, or a harness standing in
        // for one, must fall back to no animation rather than take the
        // whole script down — live updates and the typing indicator live
        // in here too. Found by the typing spec, which runs this script
        // for real against a stub window.
        const MOTION_OK = typeof window.matchMedia === "function"
          && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
        const BEAT_MS = 160;
        let sowing = null;          // the run in flight, so a second cannot start
        let pendingResync = false;  // newest state only, never a queue
        const seenReplays = new Set();

        // Sets sowing only once a run actually starts, and always clears
        // it. An earlier draft had the CALLERS assign it around every
        // call, so a page with nothing to replay — or a reader with
        // reduced motion — left a promise in sowing that resync then
        // waited on for ever, and live updates stopped entirely. The
        // typing spec caught it by counting fetches that never happened.
        const playSow = async (root) => {
          if (!MOTION_OK) return;
          const data = root.querySelector("#sow-replay");
          if (!data) return;
          let replay;
          try { replay = JSON.parse(data.textContent); } catch { return; }
          if (!replay || !replay.drops || !replay.drops.length) return;
          // One run per move. The fragment is re-fetched on every event in
          // the room, so without this the same sow would replay whenever
          // anybody said anything at the table.
          const id = replay.side + ":" + replay.pit + ":" + replay.direction + ":" + replay.drops.length;
          if (seenReplays.has(id)) return;
          seenReplays.add(id);

          const board = root.querySelector(".board");
          if (!board) return;
          const pit = (i) => board.querySelector('[data-pit="' + i + '"]');
          const beat = () => new Promise((r) => setTimeout(r, BEAT_MS));

          board.setAttribute("data-sowing", "true");
          let release;
          sowing = new Promise((r) => { release = r; });
          try {
            for (const d of replay.drops) {
              const cell = pit(d.at);
              if (!cell) continue;
              // A class per beat, removed on the next frame so the same pit
              // can flash twice in a row when the hand comes round again.
              cell.setAttribute("data-beat", d.kind);
              await beat();
              cell.removeAttribute("data-beat");
            }
          } finally {
            board.removeAttribute("data-sowing");
            sowing = null;
            release();
            // The state that arrived while this was running — only the
            // latest, never a backlog of stale ones.
            if (pendingResync) { pendingResync = false; resync(); }
          }
        };

        const resync = async () => {
          // Chosen deliberately: a run in flight is allowed to finish, and
          // the newer state is applied after it. Only ever ONE pending
          // resync, so a burst of events cannot queue up behind it and
          // replay the board through a history it already left.
          if (sowing) { pendingResync = true; return; }
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
            if (await swap(table, "/table" + (pit === null ? "" : "?pit=" + encodeURIComponent(pit)))) {
              // The board is already correct; this retells the move that
              // got it there.
              await playSow(table);
            }
          }
          if (await swap(room, "/room")) {${scrollAfterSwap}
          }
          // The board is a sibling of #room for the same reason the game
          // table is: replacing the markup inside an open <dialog> would
          // destroy the dialog and slam the drawer shut on whoever was
          // reading it. So each is fetched and swapped on its own.
          const boardList = document.getElementById("board-list");
          if (boardList) await swap(boardList, "/board");
        };
        // The mover's own page: a move is a POST that redirects, so the
        // page they land on is newly rendered and already carries the
        // replay. Called here rather than beside the element lookup above
        // because playSow and resync are const declarations that reference
        // each other — calling either before both exist is a temporal dead
        // zone error that takes the whole script down with it, and the
        // board would stop updating live at all.
        if (table) playSow(table);

        // The one place the payload is read rather than ignored.
        //
        // Every other event means "something changed, fetch it again", and
        // the payload has always been an opaque string the client throws
        // away. Typing is the exception and must NOT resync: refetching
        // the room on every keystroke would be a request per character
        // from every person watching, and it would wipe a half-written
        // message out of the box the moment somebody else started typing.
        //
        // Everything that is not a typing event falls through to resync
        // unchanged, so the contract holds for every payload that existed
        // before this one.
        const typing = document.getElementById("typing");
        let typingClear;
        stream.onmessage = (e) => {
          if (e.data.startsWith("typing:")) {
            if (!typing) return;
            const who = e.data.slice(7);
            typing.textContent = who + " is typing…";
            clearTimeout(typingClear);
            // Three seconds, against a two-second minimum between pings,
            // so a steady typist never flickers and a person who walked
            // away mid-sentence stops "typing" on their own. Nothing is
            // stored anywhere, so there is nothing to clean up if the
            // sender simply vanishes.
            typingClear = setTimeout(() => { typing.textContent = ""; }, 3000);
            return;
          }
          // Somebody said something, so whatever they were typing has
          // arrived. Leaving the bubble up over their own message is the
          // small wrongness every chat app has; this one costs a line.
          if (typing) { clearTimeout(typingClear); typing.textContent = ""; }
          resync();
        };

        ${
          isMeeting
            ? `// Tell the room, at most as often as the server will accept.
        const body = document.getElementById("body");
        if (body) {
          let lastSent = 0;
          body.addEventListener("input", () => {
            // An empty box is not typing — it is somebody who just
            // deleted what they wrote.
            if (!body.value) return;
            const now = Date.now();
            if (now - lastSent < 2000) return;
            lastSent = now;
            fetch("/typing", {
              method: "POST",
              headers: { "content-type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ house: ${JSON.stringify(house.slug)} }).toString(),
              // Nothing is read from the response and nothing depends on
              // it arriving, so a failure here is not worth a handler.
            }).catch(() => {});
          });
        }`
            : ""
        }
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
/** The months an album actually covers, for its cover. Derived from the
 *  keepings themselves rather than written by hand: a subtitle somebody
 *  invented for a house would be a claim about a real place that the app
 *  has no business making. UTC, like every other time here. */
function keptSpan(things: ThingView[]): string {
  const months = things
    .map((t) => t.keptAt)
    .filter((k): k is string => Boolean(k))
    .map((k) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(k) ? k : `${k.replace(" ", "T")}Z`))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!months.length) return "Nothing kept here yet";
  const label = (d: Date): string =>
    `${d.toLocaleString("en", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
  const first = label(months[0]!);
  const last = label(months[months.length - 1]!);
  return first === last ? `Kept ${first}` : `Kept ${first} \u2013 ${last}`;
}

function shelfCard(t: ThingView, house: House): string {
  const everyone = [t.placedByName, ...t.keeperNames];
  return `<li class="thing card-shelf">
        <div class="card-shelf-body">
      ${titleLine(t, "h3")}
      ${bodyWithPhoto(t)}
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
  // Three albums, one per household: the shelf is a bookcase, and each
  // home keeps its own book. The meeting house gets none — a remark at the
  // table belongs to whoever was there rather than to a house, and giving
  // it a book would make the table a fourth home it was never meant to be.
  //
  // Every album renders OPEN, with all of its pages in the markup. The
  // script closes them and turns one page at a time; with no script the
  // shelf is a complete, readable list of everything kept, which is the
  // promise CLAUDE.md records. A memory behind a page nobody can turn is a
  // memory the app has lost.
  const albumHouses = visibleHouses.filter((h) => h.kind !== "meeting");
  const totalShown = albumHouses.reduce((n, h) => n + h.shelved.length, 0);

  /** Pages of PER_PAGE memories. One page for an empty album, so a book is
   *  never a cover with nothing behind it.
   *
   *  Four is a leaf you can read without scrolling and few enough that
   *  turning feels like turning. Two made Canberra's 122 kept memories
   *  into sixty-one pages, which is a flick-book rather than an album. */
  /** Two memories to a page. A page is a page: the thing that carries a
   *  number and the thing that turns are now the same object, which is
   *  what a book does and what the last arrangement got wrong — it
   *  numbered leaves but turned them in pairs, so every turn replaced
   *  both sides at once and nothing ever "slid across". */
  const PER_PAGE = 2;
  const pagesOf = (things: ThingView[], h: House): string[] => {
    // Every page carries the same running head — the album it belongs to
    // and its own number. A head that said "left" or "right" would be
    // wrong the moment that page slid to the other side, which is the
    // whole point of turning one page at a time.
    const head = (no: number): string =>
      `<p class="page-head"><span class="page-where"><span class="page-dot" aria-hidden="true"></span>${esc(h.name)}</span><span class="page-no">Page ${no}</span></p>`;
    if (!things.length) {
      return [
        `<div class="page page-empty" data-no="1">${head(1)}<p class="empty">Nothing kept in ${esc(h.name)} yet.</p><p class="note">Put something down there, and keep it together with somebody else.</p></div>`,
      ];
    }
    const out: string[] = [];
    for (let i = 0; i < things.length; i += PER_PAGE) {
      const no = i / PER_PAGE + 1;
      out.push(`<div class="page" data-no="${no}">${head(no)}<ol class="page-cards">${
        things.slice(i, i + PER_PAGE).map((t) => shelfCard(t, h)).join("")
      }</ol></div>`);
    }
    return out;
  };

  const VOLUMES = ["I", "II", "III", "IV"];
  const albums = albumHouses
    .map((h, i) => {
      const pages = pagesOf(h.shelved, h);
      const count = `${h.shelved.length} ${h.shelved.length === 1 ? "memory" : "memories"}`;
      const id = `album-${esc(h.slug)}`;
      // The cover is a LINK to the open book below it, and with no script
      // that is exactly what it does: it jumps you to the pages. The
      // script intercepts the click and opens the book instead. A control
      // that does nothing without JavaScript would teach the reader the
      // app is broken, which is the one thing CLAUDE.md will not have.
      return `<article class="album" data-album="${esc(h.slug)}" data-pages="${pages.length}">
        <h2 class="album-title" id="${id}-title">
          <a class="album-cover" href="#${id}">
            <span class="album-volume">Volume ${VOLUMES[i] ?? String(i + 1)}</span>
            <span class="album-house">${esc(h.name)}</span>
            <span class="album-span">${esc(keptSpan(h.shelved))}</span>
            <span class="album-foot">
              <span class="album-count">${esc(count)}</span>
              <span class="album-cue">Open the book</span>
            </span>
          </a>
        </h2>
        <dialog class="album-book" id="${id}" aria-labelledby="${id}-title">
          <div class="book-inner">
            <div class="album-pages">${pages.join("")}</div>
            <p class="book-foot" hidden>
              <span class="book-mark"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5Q6 2 3 5v15q5-3 9 0 4-3 9 0V5q-3-3-9 0zM12 5v15"/></svg>The village</span>
              <span class="book-turn" hidden>
                <span class="book-hint">Use <kbd>←</kbd> and <kbd>→</kbd> to turn</span>
                <button type="button" class="turn-back">‹ Back</button>
                <span class="album-where" aria-live="polite"></span>
                <button type="button" class="turn-next">Next ›</button>
              </span>
              <button type="button" class="album-close" autofocus>Close the book</button>
            </p>
          </div>
          <!-- The same two actions as the footer buttons, for a hand with a
               mouse. They are aria-hidden and out of the tab order on
               purpose: a keyboard or a screen reader gets exactly one Back
               and one Next, the labelled pair, plus the arrow keys. -->
          <button type="button" class="book-arrow turn-back" tabindex="-1" aria-hidden="true" hidden>‹</button>
          <button type="button" class="book-arrow turn-next" tabindex="-1" aria-hidden="true" hidden>›</button>
        </dialog>
      </article>`;
    })
    .join("");

  const wall = totalShown
    ? `<div class="bookcase">${albums}</div>`
    : `<div class="shelf-empty"><svg viewBox="0 0 56 48" width="56" height="48" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M28 10Q15 2 5 9v31q13-8 23 0 10-8 23 0V9q-10-7-23 1zM28 10v30M10 15q7-3 12 0M10 21q7-3 12 0M34 15q6-3 12 0M34 21q6-3 12 0"/></svg><h2>${isFilteredFrom(filters) ? "No matching memories" : "Nothing kept here yet."}</h2><p class="empty">${
        isFilteredFrom(filters)
          ? "Nothing on the shelf matches those filters. Try another year, or another word."
          : "Nothing is on the shelf yet. Leave a note in a house, then add a perspective and keep it together with someone else."
      }</p><a href="${isFilteredFrom(filters) ? "/shelf" : "/"}">${isFilteredFrom(filters) ? "Clear the filters" : "Visit the village"} →</a></div>`;
  const yearOptions = years
    .map((y) => `<option value="${esc(y)}"${filters.year === y ? " selected" : ""}>${esc(y)}</option>`)
    .join("");
  const isFiltered = isFilteredFrom(filters);
  return page(
    "The memory shelf",
    `<main class="measured shelf-page">
      <div class="shelf-head">
        <div class="shelf-head-copy">
          <span class="eyebrow">Kept together. Here to stay.</span>
          <h1>Memory shelf</h1>
          <p class="lede">Our stories, kept together.</p>
          <p class="note">Little moments from different homes, with both names and the day they were kept.</p>
        </div>
        <div class="shelf-decoration"><p class="hand shelf-aside">Same people.<br>Different places.<br>A fuller story.</p><figure><img src="/img/polaroid.webp" width="271" height="177" alt="" aria-hidden="true"><figcaption>Our illustrated village</figcaption></figure></div>
      </div>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="get" action="/shelf" class="shelf-filters">
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
      <section class="shelf-memories" aria-label="Kept memories">${wall}</section>
    </main>
    <script type="module">
      // The albums. Everything above is already readable without this:
      // every book is open and every page is in the markup, and each
      // cover is a link down to its own pages.
      //
      // So the FIRST thing this does is shut the books — which means if
      // the script fails to parse, nothing is hidden and the shelf is
      // exactly the complete list the server sent. The failure mode is
      // the no-script mode, which is the whole point of the arrangement.
      const motionOk = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

      // Stand them up on the shelf. Without this class the bookcase is a
      // plain stack, which is what a reader with no script keeps.
      const bookcase = document.querySelector(".bookcase");
      if (bookcase) bookcase.classList.add("standing");

      // Two pages open at once where there is room for two, and one
      // turn moves by ONE page: the page on the right slides across to
      // the left and a new one comes down beside it. Turning by the pair
      // would replace both sides at once, which is a slide show with a
      // crease down it rather than a book.
      const twoUp = typeof window.matchMedia === "function"
        && window.matchMedia("(min-width: 761px)");

      for (const album of document.querySelectorAll(".album")) {
        const pages = [...album.querySelectorAll(".page")];
        const foot = album.querySelector(".book-foot");
        const turnBox = album.querySelector(".book-turn");
        const where = album.querySelector(".album-where");
        // Two of each: the labelled footer button and the arrow sitting
        // off the fore-edge, which is the same action for a mouse.
        const backs = [...album.querySelectorAll(".turn-back")];
        const nexts = [...album.querySelectorAll(".turn-next")];
        const arrows = [...album.querySelectorAll(".book-arrow")];
        const cover = album.querySelector(".album-cover");
        const book = album.querySelector(".album-book");
        const close = album.querySelector(".album-close");
        if (!pages.length || !foot || !cover || !book || !close) continue;
        // An old browser without <dialog> keeps the open book it was
        // sent rather than being handed a cover that will not open.
        if (typeof book.showModal !== "function") continue;

        let at = 0;
        const open2 = () => Boolean(twoUp && twoUp.matches) && pages.length > 1;
        const perView = () => (open2() ? 2 : 1);
        const lastAt = () => Math.max(0, pages.length - perView());

        const show = () => {
          const n = perView();
          at = Math.max(0, Math.min(at, lastAt()));
          // Hidden pages are not grid items, so the two that are left
          // fall into the two columns in order and nothing has to be
          // told which side it is on.
          pages.forEach((p, i) => { p.hidden = i < at || i >= at + n; });
          if (where) {
            const first = at + 1;
            const last = Math.min(at + n, pages.length);
            where.textContent = first === last
              ? "Page " + first + " of " + pages.length
              : "Pages " + first + " and " + last + " of " + pages.length;
          }
          for (const b of backs) b.disabled = at === 0;
          for (const x of nexts) x.disabled = at >= lastAt();
        };

        foot.hidden = false;
        // One page is not something you turn, and a book with nothing to
        // turn gets no controls rather than dead ones.
        if (pages.length > 1) {
          if (turnBox) turnBox.hidden = false;
          for (const a of arrows) a.hidden = false;
        }
        show();
        album.setAttribute("data-open", "false");
        // Going from one page open to two, or back, can leave the window
        // past the end of the book.
        if (twoUp && typeof twoUp.addEventListener === "function") {
          twoUp.addEventListener("change", show);
        }

        const open = () => {
          at = 0;
          show();
          album.setAttribute("data-open", "true");
          if (motionOk) {
            album.setAttribute("data-opening", "true");
            setTimeout(() => album.removeAttribute("data-opening"), 520);
          }
          book.showModal();
          document.documentElement.style.overflow = "hidden";
        };

        // Shutting it is the cover coming back down, so the book stays on
        // screen until that has played. Escape skips it, which is right:
        // Escape means out, now.
        const shut = () => {
          if (!motionOk) { book.close(); return; }
          album.setAttribute("data-closing", "true");
          setTimeout(() => book.close(), 300);
        };

        cover.addEventListener("click", (e) => { e.preventDefault(); open(); });
        close.addEventListener("click", shut);
        // The page behind the book is still the shelf: clicking it puts
        // the book back.
        book.addEventListener("click", (e) => { if (e.target === book) shut(); });
        book.addEventListener("close", () => {
          album.removeAttribute("data-closing");
          album.setAttribute("data-open", "false");
          document.documentElement.style.overflow = "";
          cover.focus();
        });

        const mark = (page, how) => {
          if (!page) return;
          page.setAttribute("data-turn", how);
          setTimeout(() => page.removeAttribute("data-turn"), 380);
        };

        const goTo = (want, dir) => {
          const limit = lastAt();
          const next = Math.max(0, Math.min(want, limit));
          if (next === at) return;
          const n = perView();
          at = next;
          show();
          if (!motionOk) return;
          // The page that slid across swings down from the side it came
          // from; the one that is new beside it simply arrives. The page
          // that left is not animated out, because it did not leave —
          // the turning leaf came down on top of it.
          if (dir === "next") {
            mark(pages[at], "to-left");
            if (n > 1) mark(pages[at + 1], "arrive");
          } else {
            if (n > 1) mark(pages[at + 1], "to-right");
            mark(pages[at], n > 1 ? "arrive" : "to-right");
          }
        };

        for (const b of backs) b.addEventListener("click", () => goTo(at - 1, "back"));
        for (const x of nexts) x.addEventListener("click", () => goTo(at + 1, "next"));

        // The arrow keys turn the page, which is what the footer says
        // they do. Only while this book is open, and never while
        // somebody is typing into something.
        book.addEventListener("keydown", (e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          const tag = (e.target.tagName || "").toLowerCase();
          if (tag === "input" || tag === "textarea" || tag === "select") return;
          if (e.key === "ArrowLeft") { e.preventDefault(); goTo(at - 1, "back"); }
          if (e.key === "ArrowRight") { e.preventDefault(); goTo(at + 1, "next"); }
        });
      }
    </script>`,
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
