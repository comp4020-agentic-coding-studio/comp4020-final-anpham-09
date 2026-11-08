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

// The dividers were the point of the chat redesign and nothing checked
// them: deleting the line that renders one left the whole suite green.
describe("the thread says which day it is", () => {
  const TWO_DAYS = new Date(Date.parse(`${TODAY}T12:00:00Z`) - 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const on = (day: string, body: string, placedBy = "dad"): ThingView =>
    view({ body, placedBy, createdAt: `${day} 09:30:00` });

  it("marks each new day once, and names today as today", () => {
    const html = roomFragment([], [on(TODAY, "newest"), on("2026-11-01", "oldest")], "meeting", TODAY);
    const days = [...html.matchAll(/<li class="thread-day"><span>([^<]*)<\/span>/g)].map((m) => m[1]);
    // Oldest first, because a conversation reads downward.
    expect(days).toEqual(["1 November 2026", "Today"]);
  });

  it("does not repeat the day for a second message on it", () => {
    const html = roomFragment([], [on(TODAY, "second"), on(TODAY, "first")], "meeting", TODAY);
    expect(html.match(/thread-day/g) ?? []).toHaveLength(1);
  });

  it("says yesterday in words", () => {
    const html = roomFragment([], [on(TWO_DAYS, "older")], "meeting", TODAY);
    expect(html).toContain(TWO_DAYS === TODAY ? "Today" : "2026");
    const yesterday = new Date(Date.parse(`${TODAY}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const y = roomFragment([], [on(yesterday, "y")], "meeting", TODAY);
    expect(y).toContain("Yesterday");
  });

  it("never groups a message with one from the day before", () => {
    // Same person either side of midnight is not a run: the divider sits
    // between them, so hiding the second one's name and face would leave a
    // bubble under a date with nobody attached to it.
    const html = roomFragment(
      [],
      [on(TODAY, "after", "mum"), on("2026-11-01", "before", "mum")],
      "meeting",
      TODAY,
    );
    expect(html.match(/data-same-sender="true"/g) ?? []).toHaveLength(0);
  });

  it("puts a dot only on somebody who is in the room now", () => {
    const html = roomFragment(["Mum"], [on(TODAY, "hers", "mum")], "meeting", TODAY);
    // placedByName is "Dad" on the fixture, so Mum being present must not
    // light up Dad's monogram.
    expect(html).toContain('data-here="false"');
    const present = roomFragment(["Dad"], [on(TODAY, "his")], "meeting", TODAY);
    expect(present).toContain('data-here="true"');
  });
});
