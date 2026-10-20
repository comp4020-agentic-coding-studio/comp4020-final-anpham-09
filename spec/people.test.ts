import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type People = typeof import("../src/people.ts");
type Houses = typeof import("../src/houses.ts");

let dbPath: string;

async function boot(): Promise<{ people: People; houses: Houses }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return {
    people: (await import("../src/people.ts")) as People,
    houses: (await import("../src/houses.ts")) as Houses,
  };
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("who is in the village", () => {
  it("lists the four houses with the meeting house last", async () => {
    const { houses } = await boot();
    expect(houses.listHouses().map((h) => h.slug)).toEqual([
      "nghe-an",
      "hanoi",
      "canberra",
      "meeting",
    ]);
    expect(houses.houseBySlug("meeting")?.kind).toBe("meeting");
    expect(houses.houseBySlug("nowhere")).toBeUndefined();
  });

  it("records a person by the name they chose, not one it made up", async () => {
    const { people } = await boot();
    const person = people.ensurePerson("tok-1", "An", "canberra");
    expect(person).toEqual({
      token: "tok-1",
      name: "An",
      homeSlug: "canberra",
      // A chosen name makes you a person, not a member. No key used here.
      memberName: null,
    });
    expect(people.nameOf("tok-1")).toBe("An");
  });

  it("remembers a key on the next request, not just the one that proved it", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-k", "An", "canberra");
    expect(people.getPerson("tok-k")?.memberName).toBe(null);

    people.setMember("tok-k", "Mum");

    // The bug this exists for: setMember wrote the row and getPerson did not
    // select the column, so the key was accepted and then forgotten by the
    // very next page load. Every request after unlocking saw a visitor, which
    // with keys cut means locked out of your own house.
    expect(people.getPerson("tok-k")?.memberName).toBe("Mum");
    expect(people.isMember(people.getPerson("tok-k"))).toBe(true);
  });

  it("refuses a blank name and an unknown house, with a reason", async () => {
    const { people } = await boot();
    expect(people.ensurePerson("tok-2", "   ", "canberra")).toBe("blank-name");
    expect(people.ensurePerson("tok-2", "An", "treehouse")).toBe("unknown-house");
    expect(people.getPerson("tok-2")).toBeUndefined();
  });

  it("lets someone change their name and move house without becoming a new person", async () => {
    const { people } = await boot();
    people.ensurePerson("tok-3", "An", "canberra");
    people.ensurePerson("tok-3", "An Pham", "meeting");
    expect(people.getPerson("tok-3")).toEqual({
      token: "tok-3",
      name: "An Pham",
      homeSlug: "meeting",
      // Changing your name and moving house does not cost you your key.
      memberName: null,
    });
  });

  it("calls an unknown token someone, rather than guessing", async () => {
    const { people } = await boot();
    expect(people.nameOf("never-seen")).toBe("someone");
  });
});
