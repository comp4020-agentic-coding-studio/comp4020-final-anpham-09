import { describe, expect, it } from "vitest";
import { markdown } from "../src/render.ts";

// A unit test on markdown() directly, so these invariants stop depending on
// what README.md happens to contain. spec/invariants.test.ts's <h1> count
// check is correct but currently vacuous against the shipped README (no
// fenced block in it yet) — it only arms itself once the README grows one.
//
// This also covers the plain-paragraph arm: the final `else` branch used to
// emit one <p> per source line, so a hand-wrapped paragraph rendered as a
// stack of disconnected one-line paragraphs — on the real README, 57 <p>
// elements for 12 actual prose paragraphs, with names like "An Duy" split
// across the break and therefore not even searchable on the served page.
// This predates crit 8; the old README rendered the same way and nothing
// caught it, because the heading test only inspects headings.

describe("markdown()", () => {
  it("coalesces a hand-wrapped quote into exactly one <blockquote>", () => {
    const html = markdown(
      "> A memory is something two of you\n> were there for.",
    );
    const matches = html.match(/<blockquote>/g) ?? [];
    expect(matches.length).toBe(1);
    expect(html).toContain("A memory is something two of you were there for.");
  });

  it("does not turn a # inside a fenced block into a heading", () => {
    const html = markdown(
      "# Real heading\n\n```\n# this is a shell comment, not a heading\necho hi\n```\n",
    );
    expect((html.match(/<h1>/g) ?? []).length).toBe(1);
    expect(html).toContain("# this is a shell comment, not a heading");
  });

  it("escapes a <script> tag found inside a fenced block", () => {
    const html = markdown("```\n<script>alert(1)</script>\n```\n");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("keeps inline formatting working inside a quote", () => {
    const html = markdown("> a **bold** word and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
  });

  it("coalesces a hand-wrapped paragraph into exactly one <p>, not one per line", () => {
    const html = markdown(
      "My nephew is named An\nDuy, and his first year is somewhere in that\nscroll.",
    );
    expect((html.match(/<p>/g) ?? []).length).toBe(1);
    // The real failure: a name split across the wrap has to be searchable as
    // one phrase on the rendered page, not torn across two <p> elements.
    expect(html).toContain("An Duy");
  });

  it("a blank line between two wrapped paragraphs produces exactly two <p>", () => {
    const html = markdown(
      "First paragraph, wrapped\nacross two lines.\n\nSecond paragraph, also\nwrapped across two lines.",
    );
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
  });

  it("a heading right after a wrapped paragraph closes the paragraph first", () => {
    const html = markdown(
      "This paragraph wraps\nacross a line break.\n## Then a heading",
    );
    expect((html.match(/<p>/g) ?? []).length).toBe(1);
    expect((html.match(/<h2>/g) ?? []).length).toBe(1);
    expect(html.indexOf("<p>")).toBeLessThan(html.indexOf("<h2>"));
  });

  it("inline formatting spanning a line break renders as one element", () => {
    const html = markdown("This is a **bold phrase\nspanning a break** in prose.");
    expect(html).toContain("<strong>bold phrase spanning a break</strong>");
  });
});
