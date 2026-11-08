import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Two hazards that live in the shape of the source rather than in anything
// the app does, both learned the hard way in one sitting.
//
// The first: this app writes CSS and SQL inside JavaScript template
// literals. Those languages have their own comment syntax, and a backtick
// written in a CSS or SQL comment — around an identifier, the way one
// naturally writes `main` or `presence` in prose — ends the literal. The
// file then fails to parse, and the error points at the comment rather than
// at the cause. It cost four dead servers before this test existed: three
// in src/render.ts's stylesheet, one in src/db.ts's schema.
//
// spec/stylesheet.test.ts checks the shipped stylesheet, but it can only
// see the CSS once the module has loaded — which is exactly what a stray
// backtick prevents. This reads the files as text instead, so it reports
// the problem as a named finding rather than as a transform error.

const SRC = new URL("../src/", import.meta.url);

const sources = (): Array<{ name: string; text: string }> =>
  readdirSync(SRC)
    .filter((f) => f.endsWith(".ts"))
    .map((name) => ({ name, text: readFileSync(new URL(name, SRC), "utf8") }));

/** The comments that can sit inside a template literal: a single-star
 *  block comment, which is how CSS comments, and an SQL line comment.
 *
 *  JSDoc — the double-star form — is deliberately excluded, and that is
 *  the whole trick. TypeScript's own doc comments live outside the
 *  literals and use backticks around identifiers constantly (26 of them in
 *  src/ right now, all harmless). CSS and SQL comments inside the literals
 *  currently contain none. So the distinction between the two comment
 *  forms separates the legitimate use from the hazard exactly, with no
 *  parsing and no guessing.
 *
 *  An earlier version of this test guessed by indentation instead —
 *  treating a comment starting at column zero as safe. The next CSS
 *  comment written after it did start at column zero, did contain a
 *  backtick, did break the build, and this guard stayed green. */
function riskyComments(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\/\*(?!\*)[\s\S]*?\*\//g)) found.push(m[0]);
  for (const m of text.matchAll(/^[^\S\n]*--[^\n]*/gm)) found.push(m[0]);
  return found;
}

describe("the source files", () => {
  it("never put a backtick in a CSS or SQL comment", () => {
    const offenders: string[] = [];
    for (const { name, text } of sources()) {
      for (const comment of riskyComments(text)) {
        if (!comment.includes("`")) continue;
        offenders.push(`${name}: ${comment.split("\n")[0].trim().slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the game engine free of every import", () => {
    // src/oanquan.ts is the rules and nothing else. It is the one module
    // that can be reasoned about without knowing anything else about the
    // app, and the property test depends on that: it imports the engine
    // directly, with no database and no server. An import of ./db.ts here
    // would not fail any test — it would just quietly make the engine
    // untestable in isolation, which is the kind of erosion nobody notices
    // until the tests are slow and flaky.
    //
    // This is the same discipline CLAUDE.md already states for
    // src/events.ts ("has no node:http import"), written down for the
    // second module that needs it.
    const engine = readFileSync(new URL("oanquan.ts", SRC), "utf8");
    const imports = [...engine.matchAll(/^\s*import\s[\s\S]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    expect(imports).toEqual([]);
  });

  it("keeps node:http out of the event hub", () => {
    // CLAUDE.md: "src/events.ts has no node:http import. That is what makes
    // real-time testable without starting a server. Keep it that way." It
    // was a rule nothing checked.
    const events = readFileSync(new URL("events.ts", SRC), "utf8");
    expect(events).not.toContain("node:http");
  });

  it("keeps node:http out of the multipart reader", () => {
    // Same rule, and for a sharper reason: this is the one module that
    // parses bytes a stranger sent. Keeping the request object out of it is
    // what lets spec/multipart.test.ts feed it bodies no browser would
    // send — a boundary with nothing after it, a part with no name, a file
    // ending on a bare CR — without standing a server up to do it.
    const multipart = readFileSync(new URL("multipart.ts", SRC), "utf8");
    // Matched as a string LITERAL rather than as bare text, unlike the
    // check above: that file's own header comment names the rule it is
    // keeping, in backticks, and a blunt substring search reads the rule
    // as a breach of itself. This still catches an import, a require and
    // a dynamic one, which is the whole hazard.
    expect(multipart).not.toMatch(/["']node:http["']/);
  });
});

describe("the routes act as a person, never as a browser", () => {
  // These tests read the source because the hazard lives in its shape.
  // The route tests run against a server in another process with no keys
  // cut, so they cannot tell a token from a person id. A route that slipped
  // back to passing `token` would record a browser as the actor and nothing
  // else would notice. Three layers, which fail differently:
  //   1. a denylist of identity-taking calls (names the exact function),
  //   2. a residue check: strip every legitimate use of `token`, then fail on
  //      any bare `token` left (catches new functions, aliases, renames),
  //   3. positive pins proving the calls exist and pass `who`, so the other
  //      two cannot pass vacuously on an empty or restructured file.
  const server = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
  const ARG = "[^,()]+"; // first argument, e.g. slug, house.slug, h.slug

  it("hands no raw cookie token to anything that records who acted", () => {
    expect(server.length).toBeGreaterThan(1000);
    const forbidden: Array<[name: string, pattern: RegExp]> = [
      ["place", new RegExp(`\\bplace\\(\\s*${ARG},\\s*token\\b`)],
      ["addPerspective", new RegExp(`\\baddPerspective\\(\\s*${ARG},\\s*token\\b`)],
      ["keepTogether", new RegExp(`\\bkeepTogether\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["enter", /\benter\(\s*token\b/],
      ["leave", /\bleave\(\s*token\s*\)/],
      ["inRoom", new RegExp(`\\binRoom\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["shelfFor", new RegExp(`\\bshelfFor\\(\\s*${ARG},\\s*token\\b`)],
      ["onShelf", new RegExp(`\\bonShelf\\(\\s*${ARG},\\s*token\\b`)],
      ["sitDown", new RegExp(`\\bsitDown\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["standUp", new RegExp(`\\bstandUp\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["play", new RegExp(`\\bplay\\(\\s*${ARG},\\s*token\\b`)],
      ["endGame", new RegExp(`\\bendGame\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["concede", new RegExp(`\\bconcede\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["placeGame", new RegExp(`\\bplaceGame\\(\\s*${ARG},\\s*token\\s*\\)`)],
      ["gameAt", new RegExp(`\\bgameAt\\(\\s*${ARG},\\s*token\\s*\\)`)],
    ];
    const slipped = forbidden.filter(([, re]) => re.test(server)).map(([name]) => name);
    expect(slipped).toEqual([]);
  });

  it("leaves no bare `token` outside the places that legitimately hold one", () => {
    // Every use of `token` that is allowed to remain, and why. Anything else
    // (an alias like `const t = token`, a renamed import, a new call) shows
    // up as residue and fails.
    const allowed: Array<[why: string, re: RegExp]> = [
      ["block comments are prose", /\/\*[\s\S]*?\*\//g],
      ["line comments are prose", /^\s*\/\/.*$/gm],
      ["allowTyping rate-limits a browser, not a person", /function allowTyping\(token: string\)[\s\S]*?\n\}\n/],
      ["the cookie is read, minted and set here: the one place a token is born", /let token = readCookie\([^\n]*\n/],
      ["...minted when absent", /if \(!token\) \{\s*token = newToken\(\);\s*setCookie = [^\n]*\n/],
      ["looking up the person behind this session", /getPerson\(token\)/],
      ["deriving the person id from the session", /personId\(me, token\)/],
      ["account creation is per session", /ensurePerson\(token\b/g],
      ["signing in binds this session to an account", /setMember\(token\b/g],
      // Signing out is per SESSION on purpose: it releases this browser,
      // not every browser the account is signed in on. Clearing it by
      // person id would sign you out of your phone from your laptop.
      ["signing out releases this session, not the account everywhere", /clearMember\(token\)/g],
      // The actor field is the session on purpose: it is how two requests
      // are known to come from one browser, which is the question a log is
      // asked. The person id is recorded alongside it by log.ts.
      ["the audit log's actor field records the session on purpose", /actor\((?:me|result|undefined|getPerson\(token\)), token\)/g],
      ["typing is throttled per browser", /allowTyping\(token\)/g],
    ];
    let residue = server;
    for (const [, re] of allowed) residue = residue.replace(re, "");
    const left = residue.split("\n").filter((line) => /\btoken\b/.test(line) || /\.token\b/.test(line));
    expect(left).toEqual([]);
  });

  it("really does call each of them as `who`", () => {
    const pins: Array<[name: string, pattern: RegExp]> = [
      ["const who", /const who = personId\(me, token\)/],
      ["place", new RegExp(`\\bplace\\(\\s*${ARG},\\s*who\\b`)],
      ["addPerspective", new RegExp(`\\baddPerspective\\(\\s*${ARG},\\s*who\\b`)],
      ["keepTogether", new RegExp(`\\bkeepTogether\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["enter", /\benter\(\s*who\b/],
      ["leave", /\bleave\(\s*who\s*\)/],
      ["inRoom", new RegExp(`\\binRoom\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["shelfFor", new RegExp(`\\bshelfFor\\(\\s*${ARG},\\s*who\\b`)],
      ["sitDown", new RegExp(`\\bsitDown\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["standUp", new RegExp(`\\bstandUp\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["play", new RegExp(`\\bplay\\(\\s*${ARG},\\s*who\\b`)],
      ["endGame", new RegExp(`\\bendGame\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["concede", new RegExp(`\\bconcede\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["placeGame", new RegExp(`\\bplaceGame\\(\\s*${ARG},\\s*who\\s*\\)`)],
      ["gameAt", new RegExp(`\\bgameAt\\(\\s*${ARG},\\s*who\\s*\\)`)],
    ];
    const missing = pins.filter(([, re]) => !re.test(server)).map(([name]) => name);
    expect(missing).toEqual([]);
  });
});
