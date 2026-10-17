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
});
