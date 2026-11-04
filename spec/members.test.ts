import { beforeEach, describe, expect, it, vi } from "vitest";

type Members = typeof import("../src/members.ts");

/** The codes are read once at boot, so a test that wants a village with
 *  codes cut has to set the secret and then import the module. Two stages:
 *  hash a code with a fresh module, then boot a second one that holds it. */
async function villageWith(secret?: Record<string, string>): Promise<Members> {
  vi.resetModules();
  if (secret) process.env.HOUSEHOLD_CODES = JSON.stringify(secret);
  else delete process.env.HOUSEHOLD_CODES;
  return (await import("../src/members.ts")) as Members;
}

async function hashOf(key: string): Promise<string> {
  const { hashKey } = await villageWith();
  return hashKey(key);
}

beforeEach(() => {
  delete process.env.HOUSEHOLD_CODES;
});

describe("who may start something in a house", () => {
  it("lets you put something down in your own home", async () => {
    const { mayPlace } = await villageWith();
    expect(mayPlace("home", "canberra", "canberra")).toBe(true);
  });

  it("refuses a guest starting something in a home that is not theirs", async () => {
    const { mayPlace } = await villageWith();
    // THE REVERSAL. This test used to assert the opposite: "lets a member
    // change a home, including one that is not theirs", on the argument
    // that the family is one family however many cities it is in. That was
    // true when a key meant "one of us" — five keys, cut by hand, given to
    // five people. Registration is open now, so "signed in" no longer means
    // "family", and a home has to be its household's own. The README and
    // CLAUDE.md changed with this line, not after it.
    expect(mayPlace("home", "nghe-an", "canberra")).toBe(false);
    expect(mayPlace("home", null, "canberra")).toBe(false);
  });

  it("keeps the meeting house open to everyone, household or not", async () => {
    const { mayPlace } = await villageWith();
    // It belongs to nobody, so there is no household it could be "theirs".
    expect(mayPlace("meeting", null, "meeting")).toBe(true);
    expect(mayPlace("meeting", "hanoi", "meeting")).toBe(true);
  });
});

describe("who may respond to what is already here", () => {
  it("lets anybody signed in write their side and keep it, in any house", async () => {
    const { mayRespond } = await villageWith();
    expect(mayRespond(true)).toBe(true);
  });

  it("refuses somebody who is not signed in", async () => {
    const { mayRespond } = await villageWith();
    expect(mayRespond(false)).toBe(false);
  });

  it("is what makes the shelf reachable for a household of one", async () => {
    const { mayPlace, mayRespond } = await villageWith();
    // An lives alone in Canberra. He may start something there; nobody else
    // may. If responding were also limited to the household, nothing he
    // placed could ever be corroborated, and his shelf would stay empty for
    // ever. These two answers differing is the whole point.
    expect(mayPlace("home", "canberra", "canberra")).toBe(true);
    expect(mayPlace("home", "nghe-an", "canberra")).toBe(false);
    expect(mayRespond(true)).toBe(true);
  });
});

describe("a household code, which is not a password", () => {
  it("cuts no codes at all without the secret, so any house may be claimed", async () => {
    const { housesWithCodes, codesCut, codeOpens, householdNeedsCode } = await villageWith();
    expect(housesWithCodes()).toEqual([]);
    expect(codesCut()).toBe(0);
    expect(codeOpens("nghe-an", "anything")).toBe(false);
    // A door with no lock on it is open: a missing secret must not make the
    // app unusable for the family, only unguarded.
    expect(householdNeedsCode("nghe-an")).toBe(false);
  });

  it("recognises a code only for its own house, and refuses a wrong one", async () => {
    const members = await villageWith({
      "nghe-an": await hashOf("the parents' code"),
      hanoi: await hashOf("the brother's code"),
    });
    expect(members.codesCut()).toBe(2);
    expect(members.housesWithCodes()).toEqual(["nghe-an", "hanoi"]);
    expect(members.codeOpens("nghe-an", "the parents' code")).toBe(true);
    expect(members.codeOpens("hanoi", "the brother's code")).toBe(true);
    // A code belongs to one house. Hanoi's does not open Nghe An.
    expect(members.codeOpens("nghe-an", "the brother's code")).toBe(false);
    expect(members.codeOpens("nghe-an", "nearly the parents' code")).toBe(false);
    expect(members.codeOpens("narnia", "the parents' code")).toBe(false);
  });

  it("requires a code only for a house that has one", async () => {
    const members = await villageWith({ "nghe-an": await hashOf("the parents' code") });
    expect(members.householdNeedsCode("nghe-an")).toBe(true);
    // Canberra has no code cut, so it is claimable without one. That is a
    // decision about a half-configured village, not an oversight.
    expect(members.householdNeedsCode("canberra")).toBe(false);
  });

  it("salts every code, so the same code twice is stored differently", async () => {
    const { hashKey } = await villageWith();
    const once = hashKey("same code");
    const twice = hashKey("same code");
    expect(once).not.toBe(twice);
    // Deterministic given its salt, which is what makes verification work.
    const salt = once.split(":")[0]!;
    expect(hashKey("same code", salt)).toBe(once);
  });

  it("refuses to boot on a malformed secret rather than silently unlock every house", async () => {
    vi.resetModules();
    process.env.HOUSEHOLD_CODES = "{not json";
    await expect(import("../src/members.ts")).rejects.toThrow(/could not be read/);
  });
});

describe("a secret that parses but is not codes", () => {
  it("drops a placeholder left in the secret instead of counting it as a code", async () => {
    // The real incident, in its new shape: the template pasted with its
    // "..." still in it. Valid JSON, three houses, not one of them a hash.
    const members = await villageWith({
      "nghe-an": "...",
      hanoi: "...",
      canberra: "...",
    });
    expect(members.codesCut()).toBe(0);
    expect(members.codeProblems()).toEqual(["nghe-an", "hanoi", "canberra"]);
    // The point of dropping them: counting them would make every household
    // require a code that can never verify, so nobody could ever claim one.
    expect(members.householdNeedsCode("nghe-an")).toBe(false);
  });

  it("keeps the good entries and names only the bad ones", async () => {
    const members = await villageWith({
      "nghe-an": await hashOf("the parents' code"),
      hanoi: "...",
    });
    expect(members.codesCut()).toBe(1);
    expect(members.housesWithCodes()).toEqual(["nghe-an"]);
    expect(members.codeProblems()).toEqual(["hanoi"]);
    expect(members.codeOpens("nghe-an", "the parents' code")).toBe(true);
    // One real code still guards its own house.
    expect(members.householdNeedsCode("nghe-an")).toBe(true);
    // And the broken one leaves its house unguarded rather than unusable.
    expect(members.householdNeedsCode("hanoi")).toBe(false);
  });

  it("rejects a hash truncated by a wrapped paste, which still looks like one", async () => {
    const full = await hashOf("the parents' code");
    const members = await villageWith({ "nghe-an": full.slice(0, full.length - 8) });
    expect(members.codesCut()).toBe(0);
    expect(members.codeProblems()).toEqual(["nghe-an"]);
  });

  it("says nothing is wrong when every entry is a hash", async () => {
    const members = await villageWith({ "nghe-an": await hashOf("the parents' code") });
    expect(members.codeProblems()).toEqual([]);
  });
});
