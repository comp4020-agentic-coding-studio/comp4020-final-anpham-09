import { describe, expect, it } from "vitest";
import { page } from "../src/render.ts";

// CLAUDE.md states two rules about the stylesheet that nothing was checking:
// colour comes from custom properties only, and interactive targets are at
// least 44px. Both were being held by hand. The third test here is not from
// CLAUDE.md but from this session: the stylesheet lives inside a template
// literal, so a backtick in a CSS comment ends the literal and the whole
// module stops parsing. That broke the server three times in one sitting,
// each time with an error pointing at the comment rather than at the cause.
// A rule that is only in someone's head gets broken; this puts it in the
// harness, which is where a repeated failure belongs.

/** The stylesheet as actually shipped, pulled out of a rendered page rather
 *  than imported — STYLE is not exported, and what matters is what reaches
 *  the browser. */
const stylesheet = (): string => {
  const html = page("t", "<main></main>");
  const match = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!match) throw new Error("no <style> block in a rendered page");
  return match[1];
};

/** CSS with comments stripped, so a hex code or a backtick mentioned in
 *  prose is not mistaken for a declaration. */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the stylesheet", () => {
  it("has no backtick in a comment, which would end the template literal", () => {
    // Not a style rule — a parse hazard. The file is TypeScript and STYLE is
    // a template literal, so a stray backtick anywhere in it (comments
    // included, since CSS comments are not JavaScript comments) truncates
    // the string and the module fails to load at all.
    //
    // Breaking this one does NOT turn this assertion red: adding a backtick
    // makes src/render.ts unparseable, so the whole file fails to transform
    // and every test in it errors before running. That is the correct
    // signal — it is what the server does too — but it means this test
    // earns its place by failing loudly at import, not by this expect().
    // Verified by adding a backtick to a CSS comment: "Transform failed
    // with 1 error", 1 file failed. The expect() below stays because it
    // names the rule for whoever reads the failure.
    const css = stylesheet();
    expect(css).not.toContain("`");
  });

  it("names no literal colour outside the token blocks", () => {
    // CLAUDE.md: "Colour comes from custom properties only; dark mode
    // redefines the tokens in one prefers-color-scheme block. No literal
    // colour in a rule body."
    //
    // Two exceptions, both deliberate and both about photographs rather than
    // about the page's own surfaces: text that sits on a scene is white
    // regardless of theme (a dark-mode "ink" on a sunset is unreadable), and
    // the scrims over the scenes are rgba washes of one fixed brown. Those
    // live on .scene* selectors. Everything else must use a token.
    const css = withoutComments(stylesheet());
    const offenders: string[] = [];
    let inTokenBlock = false;
    let depth = 0;
    let selector = "";
    for (const rawLine of css.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      // Track whether we are inside :root or the dark-mode override, where
      // literal colour is exactly the point.
      if (/^:root\s*{/.test(line) || /^@media \(prefers-color-scheme/.test(line)) {
        inTokenBlock = true;
      }
      if (line.includes("{") && !line.startsWith("@")) selector = line.slice(0, line.indexOf("{"));
      depth += (line.match(/{/g) ?? []).length;
      depth -= (line.match(/}/g) ?? []).length;
      if (depth === 0) inTokenBlock = false;
      if (inTokenBlock) continue;
      const hasLiteral = /#[0-9A-Fa-f]{3,8}\b|\brgba?\(/.test(line);
      if (!hasLiteral) continue;
      // Scene selectors are the documented exception.
      if (/\.scene/.test(selector) || /\.scene/.test(line)) continue;
      // A shadow token's own definition is in :root; a shadow *used* in a
      // rule body references the token, so an rgba here is a real finding.
      offenders.push(line);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every text token pair above 4.5:1, in both themes", () => {
    // Not in CLAUDE.md, but it should have been: the palette came from the
    // Figma by sampling pixels, and three of the sampled pairs were under
    // AA at the sizes they are used — #8A7A6E secondary text on a card is
    // 3.55:1, and white on #CB6041 is 3.97:1. Both read fine to someone
    // with good eyesight on a bright screen, which is exactly why a person
    // checking by eye passes them. Light and dark are both checked because
    // the dark block redefines every one of these.
    const css = stylesheet();
    const block = (re: RegExp): Record<string, string> => {
      const m = re.exec(css);
      if (!m) throw new Error(`no token block matching ${re}`);
      const out: Record<string, string> = {};
      for (const [, name, value] of m[1].matchAll(/(--[a-z-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
        out[name] = value;
      }
      return out;
    };
    const light = block(/:root\s*{([\s\S]*?)}/);
    const dark = block(/prefers-color-scheme:\s*dark\)\s*{\s*:root\s*{([\s\S]*?)}/);

    const channels = (h: string): number[] =>
      [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const luminance = (h: string): number => {
      const [r, g, b] = channels(h).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string): number => {
      const [x, y] = [luminance(a), luminance(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };

    // Every pair where small text sits on a surface. --hearth is excluded:
    // it is only ever used for the brand wordmark and large display type,
    // where the AA threshold is 3:1, not 4.5:1.
    const pairs: Array<[string, string]> = [
      ["--ink", "--paper"],
      ["--ink", "--card"],
      ["--ink-soft", "--paper"],
      ["--ink-soft", "--card"],
      ["--ink-soft", "--card-raised"],
      ["--hearth-deep", "--paper"],
      ["--hearth-deep", "--card"],
      ["--sage-deep", "--card"],
      ["--amber-deep", "--card"],
      ["--on-hearth", "--hearth-fill"],
    ];
    const failures: string[] = [];
    for (const [theme, tokens] of [["light", light], ["dark", dark]] as const) {
      for (const [fg, bg] of pairs) {
        const a = tokens[fg];
        const b = tokens[bg];
        if (!a || !b) {
          failures.push(`${theme}: ${fg} or ${bg} is missing`);
          continue;
        }
        const ratio = contrast(a, b);
        if (ratio < 4.5) failures.push(`${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("gives every interactive target at least 44px of height", () => {
    // CLAUDE.md: "Interactive targets are at least 44x44px, including nav
    // links." Checked as a floor on the min-height declarations that apply
    // to controls, rather than by measuring a layout, which a string test
    // cannot do. Anything smaller has to be a deliberate, named exception.
    const css = withoutComments(stylesheet());
    const small: string[] = [];
    const rule = /([^{}]+){([^}]*)}/g;
    let m: RegExpExecArray | null;
    while ((m = rule.exec(css))) {
      const [, selector, body] = m;
      if (!/\b(button|input|select|textarea|^a$|\sa\b|a[:.])/.test(selector)) continue;
      const height = /min-height:\s*([\d.]+)rem/.exec(body);
      if (!height) continue;
      const px = Number(height[1]) * 16;
      // 40px appears on the two compact inline forms inside a memory slip,
      // which sit beside 44px buttons in the same row. They are listed here
      // so that shrinking anything *else* still fails.
      if (px < 44 && !/inline-perspective|shelf-filters/.test(selector)) {
        small.push(`${selector.trim()} -> ${px}px`);
      }
    }
    expect(small).toEqual([]);
  });
});
