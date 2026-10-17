import { describe, expect, it } from "vitest";
import { roomFragment } from "../src/render.ts";
import type { ThingView } from "../src/things.ts";

// The meeting house takes a line with no title (a remark at the table is not
// an artefact). Nothing was checking what that renders as, and the first
// version rendered `<p class="thing-title"></p>` — an empty element holding
// a gap on the page, and a heading a screen reader announces with no words
// in it. Found by reading the DOM of a real message, not by a test, which is
// why there is now a test.
//
// This renders through the real `roomFragment`, no server and no database:
// the thing being checked is the markup, and a ThingView is a plain object.

const view = (over: Partial<ThingView> = {}): ThingView => ({
  id: 1,
  title: "",
  body: "I used to play this after school.",
  eventDate: null,
  placedBy: "dad",
  placedByName: "Dad",
  createdAt: new Date().toISOString(),
  perspectives: [],
  keeperNames: [],
  onShelf: false,
  keptAt: null,
  isOwn: false,
  viewerHasKept: false,
  viewerHasPerspective: false,
  ...over,
});

describe("a thing with no title", () => {
  it("renders no title element at the table", () => {
    const html = roomFragment([], [view()], "meeting");
    expect(html).toContain("I used to play this after school.");
    expect(html).not.toContain("thing-title");
  });

  it("renders no title element in a house either", () => {
    // Household houses require a title now, but things placed before the
    // app asked for one still exist and still have to render.
    const html = roomFragment([], [view()], "canberra");
    expect(html).toContain("I used to play this after school.");
    expect(html).not.toContain("thing-title");
  });

  it("still renders the title when there is one", () => {
    // The guard against a fix that simply stops rendering titles at all.
    for (const house of ["meeting", "canberra"]) {
      const html = roomFragment([], [view({ title: "Our old friend" })], house);
      expect(html, house).toContain("thing-title");
      expect(html, house).toContain("Our old friend");
    }
  });

  it("does not render a title made only of spaces", () => {
    const html = roomFragment([], [view({ title: "   " })], "meeting");
    expect(html).not.toContain("thing-title");
  });
});
