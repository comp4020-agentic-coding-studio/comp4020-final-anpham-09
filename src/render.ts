import type { ClaimView } from "./claims.ts";

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STYLE = `
:root {
  --ink: oklch(0.22 0 90);
  --paper: oklch(0.99 0.005 95);
  --rule: oklch(0.87 0 0);
  --quiet: oklch(0.52 0 0);
  --asserted: oklch(0.55 0.12 75);
  --corroborated: oklch(0.52 0.12 160);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: oklch(0.93 0 0); --paper: oklch(0.18 0.01 260); --rule: oklch(0.35 0 0);
    --quiet: oklch(0.70 0 0); --asserted: oklch(0.80 0.11 75); --corroborated: oklch(0.78 0.11 160);
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
.status { font-weight: 600; font-size: 0.85rem; letter-spacing: 0.02em; }
.status[data-status="asserted"] { color: var(--asserted); }
.status[data-status="corroborated"] { color: var(--corroborated); }
.note { color: var(--quiet); font-size: 0.85rem; }
.empty { color: var(--quiet); }
main :is(h2,h3) { margin-top: 2rem; }
pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
`;

export function page(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style>
</head><body>
<nav aria-label="site"><a href="/">Claims</a><a href="/readme/">About</a></nav>
${inner}
</body></html>`;
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
