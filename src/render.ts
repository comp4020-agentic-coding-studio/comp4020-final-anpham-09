import type { ClaimView } from "./claims.ts";
import type { House } from "./houses.ts";
import type { Person } from "./people.ts";
import type { ThingView } from "./things.ts";

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE = `
:root {
  --ink: oklch(0.24 0.02 60);
  --paper: oklch(0.98 0.012 85);
  --rule: oklch(0.86 0.02 70);
  --quiet: oklch(0.52 0.02 70);
  --room: oklch(0.58 0.10 55);
  --shelf: oklch(0.50 0.09 150);
  --here: oklch(0.55 0.13 250);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: oklch(0.93 0.01 80); --paper: oklch(0.19 0.02 60); --rule: oklch(0.36 0.02 70);
    --quiet: oklch(0.72 0.02 70); --room: oklch(0.80 0.10 55);
    --shelf: oklch(0.78 0.09 150); --here: oklch(0.80 0.11 250);
  }
}
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 1.5rem 1rem 4rem; max-width: 42rem;
  font: 16px/1.6 ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--paper); }
nav { display: flex; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--rule); }
h1 { font-size: 1.5rem; margin: 1.5rem 0 0.25rem; }
.lede { color: var(--quiet); margin-top: 0; }
form { display: grid; gap: 0.5rem; margin: 1.5rem 0; }
label { font-weight: 600; font-size: 0.9rem; }
input, button { font: inherit; padding: 0.6rem 0.7rem; min-height: 44px;
  border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: var(--ink); }
button { cursor: pointer; font-weight: 600; }
ol { list-style: none; padding: 0; }
li.claim { border-top: 1px solid var(--rule); padding: 1rem 0; }
.body { font-size: 1.05rem; margin: 0 0 0.35rem; }
.meta { color: var(--quiet); font-size: 0.85rem; margin: 0 0 0.6rem; }
.note { color: var(--quiet); font-size: 0.85rem; }
.empty { color: var(--quiet); }
main :is(h2,h3) { margin-top: 2rem; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
.state { font-weight: 600; font-size: 0.85rem; letter-spacing: 0.02em; }
.state[data-state="in-the-room"] { color: var(--room); }
.state[data-state="on-the-shelf"] { color: var(--shelf); }
.here { color: var(--here); font-size: 0.9rem; }
ul.village { list-style: none; padding: 0; display: grid; gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
li.house { border: 1px solid var(--rule); border-radius: 10px; padding: 1rem; }
li.house a { font-weight: 600; font-size: 1.05rem; display: inline-block; min-height: 44px; }
li.thing { border-top: 1px solid var(--rule); padding: 1rem 0; }
`;

export function page(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style>
</head><body>
<nav aria-label="site"><a href="/">The village</a><a href="/readme/">About</a></nav>
${inner}
</body></html>`;
}

const names = (list: string[]): string =>
  list.length === 1 ? esc(list[0]) : list.slice(0, -1).map(esc).join(", ") + " and " + esc(list[list.length - 1]);

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

/** The room list on its own, so the event stream can swap it in without
 *  reloading the page. Rendered by the same function either way. */
export function roomFragment(things: ThingView[], houseSlug: string): string {
  if (!things.length) {
    return `<p class="empty">Nothing in this room yet. Put something down — it stays
      here either way, and goes on the shelf when somebody else is here for it.</p>`;
  }
  return `<ol>${things.map((t) => thingItem(t, houseSlug)).join("")}</ol>`;
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
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/join">
        <label for="name">What should everyone call you?</label>
        <input id="name" name="name" required maxlength="40" placeholder="An">
        <label for="home">Which house is yours?</label>
        <select id="home" name="home" required>${options}</select>
        <button>Go in</button>
      </form>
    </main>`,
  );
}

export function mapPage(
  houses: Array<House & { hereNames: string[] }>,
  me: Person,
  message: string | null,
): string {
  const cards = houses
    .map(
      (h) => `<li class="house">
        <a href="/house/${esc(h.slug)}">${esc(h.name)}</a>
        <p class="here">${h.hereNames.length ? names(h.hereNames) + (h.hereNames.length === 1 ? " is here" : " are here") : "Nobody is here"}</p>
      </li>`,
    )
    .join("");
  return page(
    "The village",
    `<main>
      <h1>The village</h1>
      <p class="lede">A thing you put down stays in the room you put it in.
        It goes on that house's shelf when somebody else was there for it —
        a memory is something two of you were there for.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <h2>Houses</h2>
      <ul class="village">${cards}</ul>
      <p class="note">You're here as <strong>${esc(me.name)}</strong>.
        <a href="/leave">Leave the village</a></p>
    </main>`,
  );
}

export function housePage(
  house: House,
  me: Person,
  hereNames: string[],
  things: ThingView[],
  message: string | null,
): string {
  const others = hereNames.filter((n) => n !== me.name);
  return page(
    house.name,
    `<main>
      <h1>${esc(house.name)}</h1>
      <p class="lede" id="who">${others.length ? names(others) + (others.length === 1 ? " was here in the last minute." : " were here in the last minute.") : "Nobody else has been here in the last minute."}</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/place">
        <input type="hidden" name="house" value="${esc(house.slug)}">
        <label for="body">What do you want to put down here?</label>
        <input id="body" name="body" required maxlength="280" placeholder="He stood up on his own today">
        <button>Put it down</button>
      </form>
      <h2>In this house</h2>
      <div id="room">${roomFragment(things, house.slug)}</div>
      <p class="note"><a href="/">Back to the village</a></p>
      <script type="module">
        // Live updating is the only thing JavaScript adds. Without it the page
        // still renders, and every action is still a form POST.
        const room = document.getElementById("room");
        const stream = new EventSource("/stream?house=${esc(house.slug)}");
        stream.onmessage = async () => {
          const res = await fetch("/house/${esc(house.slug)}/room", { headers: { accept: "text/html" } });
          if (res.ok) room.innerHTML = await res.text();
        };
      </script>
    </main>`,
  );
}

/** The label is the product. "asserted" and "corroborated" are different
 *  states and the app never collapses them into a single notion of true. */
function statusLine(c: ClaimView): string {
  if (c.status === "asserted") {
    return `<span class="status" data-status="asserted">Asserted</span>
      <span class="note">— nobody else has said they saw this</span>`;
  }
  const n = c.others;
  return `<span class="status" data-status="corroborated">Corroborated</span>
    <span class="note">— ${n} other ${n === 1 ? "person says" : "people say"} they saw this too</span>`;
}

function claimItem(c: ClaimView): string {
  let action: string;
  if (c.isOwn) {
    action = `<p class="note">You made this claim, so you can't corroborate it.</p>`;
  } else if (c.viewerHasCorroborated) {
    action = `<p class="note">You've said you saw this.</p>`;
  } else {
    action = `<form method="post" action="/corroborate">
      <input type="hidden" name="claim" value="${c.id}">
      <button>I saw this too</button></form>`;
  }
  return `<li class="claim">
    <p class="body">${esc(c.body)}</p>
    <p class="meta">${esc(c.place)} · ${esc(c.authorName)} · ${esc(c.createdAt)} UTC</p>
    <p>${statusLine(c)}</p>
    ${action}
  </li>`;
}

export function claimsPage(claims: ClaimView[], viewerName: string, message: string | null): string {
  const list = claims.length
    ? `<ol>${claims.map(claimItem).join("")}</ol>`
    : `<p class="empty">No claims yet. Make the first one — it'll be marked asserted until somebody else says they saw it too.</p>`;
  return page(
    "Corroborated",
    `<main>
      <h1>Corroborated</h1>
      <p class="lede">Small claims about shared spaces at ANU. Nothing here is
        verified — a claim is either something one person said, or something
        other people have said they saw too. The app shows which, and never
        pretends to know the difference between them.</p>
      ${message ? `<p class="note" role="status">${esc(message)}</p>` : ""}
      <form method="post" action="/claim">
        <label for="body">What did you see?</label>
        <input id="body" name="body" required maxlength="280"
               placeholder="The Marie Reay lifts are out again">
        <label for="place">Where?</label>
        <input id="place" name="place" required maxlength="80" placeholder="Marie Reay, level 3">
        <button>Post claim</button>
      </form>
      <p class="note">You're posting as <strong>${esc(viewerName)}</strong>, a name this
        browser was given. There's no account, and nothing here identifies you.</p>
      <h2>Claims</h2>
      ${list}
    </main>`,
  );
}

/** Minimal markdown, enough to publish README.md legibly. The spec only
 *  requires the headings to appear in order in the HTML the server sends. */
export function markdown(src: string): string {
  const inline = (s: string): string =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const out: string[] = [];
  let list: string[] = [];
  const flush = (): void => {
    if (list.length) { out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`); list = []; }
  };
  for (const raw of src.split("\n")) {
    const line = raw.trimEnd();
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (li) { list.push(li[1]); }
    else if (!line.trim()) { flush(); }
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush();
  return out.join("\n");
}
