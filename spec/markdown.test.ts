import { describe, expect, it } from "vitest";
import { markdown } from "../src/render.ts";

// A unit test on markdown() directly, so these invariants stop depending on
// what README.md happens to contain. spec/invariants.test.ts's <h1> count
// check is correct but currently vacuous against the shipped README (no
// fenced block in it yet) — it only arms itself once the README grows one.

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
});
