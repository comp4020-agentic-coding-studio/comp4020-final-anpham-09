import { describe, expect, it } from "vitest";
import { roomFragment, timeAgo } from "../src/render.ts";
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

/** The day the dividers are drawn against. Passed in like the app passes
 *  `today()`, so this file still renders with no server and no database. */
const TODAY = new Date().toISOString().slice(0, 10);

const view = (over: Partial<ThingView> = {}): ThingView => ({
  id: 1,
  title: "",
  body: "I used to play this after school.",
  photo: null,
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
    const html = roomFragment([], [view()], "meeting", TODAY);
    expect(html).toContain("I used to play this after school.");
    expect(html).not.toContain("thing-title");
  });

  it("renders no title element in a house either", () => {
    // Household houses require a title now, but things placed before the
    // app asked for one still exist and still have to render.
    const html = roomFragment([], [view()], "canberra", TODAY);
    expect(html).toContain("I used to play this after school.");
    expect(html).not.toContain("thing-title");
  });

  it("still renders the title when there is one", () => {
    // The guard against a fix that simply stops rendering titles at all.
    for (const house of ["meeting", "canberra"]) {
      const html = roomFragment([], [view({ title: "Our old friend" })], house, TODAY);
      expect(html, house).toContain("thing-title");
      expect(html, house).toContain("Our old friend");
    }
  });

  it("does not render a title made only of spaces", () => {
    const html = roomFragment([], [view({ title: "   " })], "meeting", TODAY);
    expect(html).not.toContain("thing-title");
  });
});

// `timeAgo` is exported, renders on every message and every card, and had
// no test at all until the chat redesign put "2026-11-01 16:17:27 UTC"
// next to "4d ago" on screen.
describe("how long ago something was said", () => {
  const ago = (ms: number): string => timeAgo(new Date(Date.now() - ms).toISOString());
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("counts in the register the app speaks", () => {
    expect(ago(5_000)).toBe("just now");
    expect(ago(3 * MIN)).toBe("3m ago");
    expect(ago(5 * HOUR)).toBe("5h ago");
    expect(ago(DAY)).toBe("yesterday");
    expect(ago(3 * DAY)).toBe("3d ago");
  });

  it("gives the date, and not the clock, once it is older than a week", () => {
    // The whole stored timestamp used to come through here, seconds and
    // all. Past a week the day is the fact worth printing; 16:17:27 is
    // precision nobody can use.
    const out = timeAgo("2026-11-01 16:17:27");
    expect(out).toBe("1 November 2026");
    expect(out, "the clock is still in there").not.toMatch(/\d\d:\d\d/);
  });

  it("reads a stored timestamp as UTC, whatever the machine is set to", () => {
    // created_at is SQLite's datetime('now') — UTC with no suffix. Parsed
    // as local time, every one of these reads hours out.
    expect(timeAgo("2026-11-01 00:00:01")).toBe("1 November 2026");
    expect(timeAgo("2026-11-01T16:17:27Z")).toBe("1 November 2026");
  });
});
