import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { housePage } from "../src/render.ts";

// The typing indicator is the one feature in this app that only exists
// when JavaScript runs, so it is the one feature the HTTP tests cannot
// actually exercise: they see the markup the server sent and nothing the
// browser would then do with it.
//
// What matters here is a decision made in the client script and nowhere
// else: a typing event must NOT resync. Every other event means "something
// changed, go and fetch it", and if typing fell through to that branch the
// room would refetch on every keystroke from everybody watching, and a
// half-written message would be wiped out of the box the moment somebody
// else started typing.
//
// So the script is extracted from the rendered page and its onmessage
// handler is run against a stub EventSource. That is a narrow kind of test
// — it proves the branching, not the rendering — but the branching is the
// part with a decision in it.

const house = { id: 4, slug: "meeting", name: "The meeting house", kind: "meeting" as const };
const me = { token: "an", name: "An", homeSlug: "nghe-an", memberName: null };

/** The page, as a DOM, with the live script pulled out rather than run:
 *  jsdom has no EventSource, and the point is to drive the handler by hand
 *  anyway. */
function clientScript(): string {
  const page = housePage(house, me, [], [], null, { game: null, picked: null });
  const match = /<script type="module">([\s\S]*?)<\/script>/.exec(page);
  expect(match, "the meeting house renders a live script").not.toBe(null);
  return match![1];
}

interface Harness {
  onmessage: (e: { data: string }) => void;
  typingText: () => string;
  resyncs: () => number;
  typingPosts: () => number;
  type: (value: string) => void;
  tick: (ms: number) => void;
  /** Let the resync's awaited fetches resolve. */
  settle: () => Promise<void>;
}

/** Runs the page's own script in a jsdom window, with the two things it
 *  reaches for replaced by counters: EventSource (so events can be
 *  delivered by hand) and fetch (so a resync is a number rather than a
 *  network call). */
function harness(): Harness {
  const page = housePage(house, me, [], [], null, { game: null, picked: null });
  // The script is stripped from the HTML and evaluated separately, because
  // jsdom would refuse to run a module that constructs an EventSource it
  // does not implement.
  const html = page.replace(/<script type="module">[\s\S]*?<\/script>/, "");
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: "http://localhost/house/meeting",
  });
  const w = dom.window as unknown as Record<string, unknown> & {
    document: Document;
    setTimeout: typeof setTimeout;
  };

  let resyncs = 0;
  let typingPosts = 0;
  w.fetch = ((input: string, init?: { method?: string }) => {
    const url = String(input);
    if (url.includes("/typing")) typingPosts += 1;
    else if (url.includes("/room") || url.includes("/table")) resyncs += 1;
    void init;
    return Promise.resolve({ ok: true, text: () => Promise.resolve("") });
  }) as unknown as typeof fetch;

  const listeners: Array<(e: { data: string }) => void> = [];
  class FakeEventSource {
    set onmessage(fn: (e: { data: string }) => void) {
      listeners.push(fn);
    }
    set onopen(_fn: unknown) {
      // Deliberately dropped. The real one resyncs on open so a stream
      // that reconnected after the machine slept catches up; firing it
      // here would just add a resync to every count below.
    }
  }
  w.EventSource = FakeEventSource as unknown as typeof EventSource;

  // Timers, driven by hand so the three-second clear can be tested
  // without a three-second test.
  let now = 0;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let nextId = 1;
  w.setTimeout = ((fn: () => void, ms: number) => {
    const id = nextId++;
    timers.push({ at: now + ms, fn, id });
    return id;
  }) as unknown as typeof setTimeout;
  w.clearTimeout = ((id: number) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  }) as unknown as typeof clearTimeout;

  const script = clientScript();
  // Function rather than eval so the script's own `const`s do not leak
  // into this module's scope.
  new Function(
    "window",
    "document",
    "EventSource",
    "fetch",
    "setTimeout",
    "clearTimeout",
    "URLSearchParams",
    "location",
    "Date",
    script,
  )(
    w,
    w.document,
    w.EventSource,
    w.fetch,
    w.setTimeout,
    w.clearTimeout,
    dom.window.URLSearchParams,
    dom.window.location,
    Date,
  );

  return {
    onmessage: (e) => listeners.forEach((fn) => fn(e)),
    typingText: () => w.document.getElementById("typing")?.textContent ?? "(missing)",
    resyncs: () => resyncs,
    typingPosts: () => typingPosts,
    type: (value: string) => {
      const box = w.document.getElementById("body") as HTMLInputElement | null;
      expect(box, "the meeting house has a compose box").not.toBe(null);
      box!.value = value;
      box!.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    },
    settle: async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    },
    tick: (ms: number) => {
      now += ms;
      for (const t of [...timers]) {
        if (t.at <= now) {
          timers.splice(timers.indexOf(t), 1);
          t.fn();
        }
      }
    },
  };
}

describe("the live script's one branch", () => {
  it("shows who is typing without refetching anything", async () => {
    const h = harness();
    h.onmessage({ data: "typing:Linh" });
    expect(h.typingText()).toBe("Linh is typing…");
    // Drained before asserting zero, so this is "no resync happened",
    // not "no resync had happened yet".
    await h.settle();
    // The whole point. A resync here would be a request per keystroke
    // from every person in the room, and it would wipe a half-written
    // message out of the box.
    expect(h.resyncs()).toBe(0);
  });

  it("resyncs for every event that is not typing", async () => {
    const h = harness();
    // Every payload the app publishes today. If any of them ever started
    // with "typing:", the room would silently stop updating.
    const events = ["placed", "kept", "arrived", "perspective", "moved", "sat", "ended"];
    for (const data of events) h.onmessage({ data });
    // resync() awaits the table swap before the room swap, so the second
    // of each pair is still a pending microtask at this point. Draining
    // first, rather than asserting the number that happens to be reached
    // synchronously — that number would be 7 and would look right.
    await h.settle();

    // Two fetches per resync in the meeting house: the table and the room.
    expect(h.resyncs()).toBe(events.length * 2);
    expect(h.typingText()).toBe("");
  });

  it("stops saying someone is typing after three seconds", async () => {
    const h = harness();
    h.onmessage({ data: "typing:Linh" });
    expect(h.typingText()).toBe("Linh is typing…");
    h.tick(2_900);
    // Still up: the gap between pings is two seconds, so a steady typist
    // must never flicker.
    expect(h.typingText()).toBe("Linh is typing…");
    h.tick(200);
    expect(h.typingText()).toBe("");
  });

  it("clears the bubble when the message itself arrives", async () => {
    // Otherwise "Linh is typing…" sits there underneath the message Linh
    // just sent — the small wrongness every chat app has.
    const h = harness();
    h.onmessage({ data: "typing:Linh" });
    h.onmessage({ data: "placed" });
    expect(h.typingText()).toBe("");
  });

  it("sends at most one ping however fast somebody types", async () => {
    const h = harness();
    let typed = "";
    for (const ch of "hello there") {
      typed += ch;
      h.type(typed);
    }
    // Eleven keystrokes, one request. Without the throttle this is a
    // request per character from every person in the room.
    expect(h.typingPosts()).toBe(1);
  });

  it("says nothing when the box is emptied", async () => {
    // Deleting what you wrote is not typing, and telling the room you are
    // still at it would be a small lie.
    const h = harness();
    h.type("");
    expect(h.typingPosts()).toBe(0);
  });
});
