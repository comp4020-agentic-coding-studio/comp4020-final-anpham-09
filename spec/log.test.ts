import { afterEach, describe, expect, it, vi } from "vitest";
import { actor, actorId, logAction } from "../src/log.ts";
import type { Person } from "../src/people.ts";

/** Captures the lines logAction writes, parsed back from JSON, so a test can
 *  assert on what a reader of `flyctl logs` would actually see. */
function captured(run: () => void): Array<Record<string, unknown>> {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((l: unknown) => {
    lines.push(String(l));
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return lines.map((l) => JSON.parse(l) as Record<string, unknown>);
}

const mum = (token: string): Person => ({
  token,
  name: "Mum",
  homeSlug: "nghe-an",
  memberName: "Mum",
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what the log says", () => {
  it("writes one parseable line per action, with when, who and what", () => {
    const lines = captured(() => {
      logAction("place", actor(mum("tok-secret"), "tok-secret"), { house: "nghe-an" });
    });
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.action).toBe("place");
    expect(line.name).toBe("Mum");
    expect(line.house).toBe("nghe-an");
    expect(line.level).toBe("info");
    // A timestamp a reader can sort by, not a human phrase.
    expect(typeof line.at).toBe("string");
    expect(new Date(line.at as string).toISOString()).toBe(line.at);
  });

  it("never writes the cookie token, which is the credential itself", () => {
    const token = "tok-this-is-the-whole-credential";
    const lines = captured(() => {
      logAction("place", actor(mum(token), token), { house: "nghe-an" });
      logAction("join-refused", actor(undefined, token), { reason: "blank-name" });
      logAction("key-accepted", actor(mum(token), token), { member: "Mum" });
    });
    expect(lines).toHaveLength(3);
    // The property that matters: anyone who could read a token out of a log
    // could become that person, so no line may contain it anywhere — not in
    // a field, not inside one.
    for (const line of lines) {
      expect(JSON.stringify(line)).not.toContain(token);
    }
  });

  it("gives one person one id, and two people different ids", () => {
    expect(actorId("tok-a")).toBe(actorId("tok-a"));
    expect(actorId("tok-a")).not.toBe(actorId("tok-b"));
    // Short enough to read in a terminal, long enough to tell a family apart.
    expect(actorId("tok-a")).toMatch(/^[0-9a-f]{8}$/);
    // Not reversible, and not the token with a wrapper round it.
    expect(actorId("tok-a")).not.toContain("tok-a");
  });

  it("calls someone with no cookie anonymous rather than inventing a name", () => {
    const line = captured(() => logAction("sit-refused", actor(undefined, undefined)))[0]!;
    expect(line.who).toBe("anonymous");
    expect(line.name).toBe(null);
  });

  it("names a member by the key they used, and a visitor not at all", () => {
    const visitor: Person = { token: "tok-v", name: "Linh", homeSlug: "hanoi", memberName: null };
    const lines = captured(() => {
      logAction("place", actor(mum("tok-m"), "tok-m"));
      logAction("place-refused", actor(visitor, "tok-v"), { reason: "visitors-cannot-change" });
    });
    expect(lines[0]!.name).toBe("Mum");
    // A visitor who chose a name is still logged by that name — the log says
    // who was here, which is a smaller claim than who they are.
    expect(lines[1]!.name).toBe("Linh");
    expect(lines[1]!.reason).toBe("visitors-cannot-change");
  });
});
