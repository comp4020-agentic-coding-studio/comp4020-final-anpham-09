import { beforeEach, describe, expect, it, vi } from "vitest";

type Members = typeof import("../src/members.ts");

/** The keys are read once at boot, so a test that wants a village with keys
 *  cut has to set the secret and then import the module. Two stages: hash a
 *  key with a fresh module, then boot a second one that holds it. */
async function villageWith(secret?: Record<string, string>): Promise<Members> {
  vi.resetModules();
  if (secret) process.env.MEMBER_KEYS = JSON.stringify(secret);
  else delete process.env.MEMBER_KEYS;
  return (await import("../src/members.ts")) as Members;
}

async function hashOf(key: string): Promise<string> {
  const { hashKey } = await villageWith();
  return hashKey(key);
}

beforeEach(() => {
  delete process.env.MEMBER_KEYS;
});

describe("who may change a house", () => {
  it("opens every house when no keys have been cut", async () => {
    const { mayChange, keysCut } = await villageWith();
    expect(keysCut()).toBe(0);
    // The deliberate decision: a missing secret must not lock the family out
    // of their own houses. A door with no lock on it is open.
    expect(mayChange("home", null, 0)).toBe(true);
    expect(mayChange("meeting", null, 0)).toBe(true);
  });

  it("closes a home to a visitor once a single key exists", async () => {
    const { mayChange } = await villageWith({ Mum: await hashOf("one") });
    // The rule this whole file exists for.
    expect(mayChange("home", null, 1)).toBe(false);
  });

  it("lets a member change a home, including one that is not theirs", async () => {
    const { mayChange } = await villageWith({ Mum: await hashOf("one") });
    expect(mayChange("home", "Mum", 1)).toBe(true);
    // Mum lives in one house and may still put a note on the table of the
    // others: the family is one family, however many cities it is in.
    expect(mayChange("home", "Dad", 1)).toBe(true);
  });

  it("keeps the meeting house open to visitors however many keys exist", async () => {
    const { mayChange } = await villageWith({ Mum: await hashOf("one") });
    expect(mayChange("meeting", null, 1)).toBe(true);
    expect(mayChange("meeting", "Mum", 1)).toBe(true);
  });
});

describe("a key, which is not an account", () => {
  it("cuts no keys at all without the secret, so a fresh checkout has no members", async () => {
    const { memberNames, keysCut, memberFor } = await villageWith();
    expect(memberNames()).toEqual([]);
    expect(keysCut()).toBe(0);
    expect(memberFor("Mum", "anything")).toBe(null);
  });

  it("recognises a key only against its own name, and refuses a wrong one", async () => {
    const members = await villageWith({
      Mum: await hashOf("her key"),
      Dad: await hashOf("his key"),
    });
    expect(members.keysCut()).toBe(2);
    expect(members.memberNames()).toEqual(["Mum", "Dad"]);
    expect(members.memberFor("Mum", "her key")).toBe("Mum");
    expect(members.memberFor("Dad", "his key")).toBe("Dad");
    // A key is one person's. Dad's key does not open Mum's name.
    expect(members.memberFor("Mum", "his key")).toBe(null);
    expect(members.memberFor("Mum", "nearly her key")).toBe(null);
    expect(members.memberFor("Nobody", "her key")).toBe(null);
  });

  it("salts every key, so the same key twice is stored differently", async () => {
    const { hashKey } = await villageWith();
    const once = hashKey("same key");
    const twice = hashKey("same key");
    expect(once).not.toBe(twice);
    // Deterministic given its salt, which is what makes verification work.
    const salt = once.split(":")[0]!;
    expect(hashKey("same key", salt)).toBe(once);
  });

  it("refuses to boot on a malformed secret rather than demote everyone to a visitor", async () => {
    vi.resetModules();
    process.env.MEMBER_KEYS = "{not json";
    await expect(import("../src/members.ts")).rejects.toThrow(/could not be read/);
  });
});
