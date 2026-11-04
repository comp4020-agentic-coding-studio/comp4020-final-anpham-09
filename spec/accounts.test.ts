import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Accounts = typeof import("../src/accounts.ts");

let dbPath: string;

/** A fresh database per test, the same two-stage trick the identity spec
 *  uses: src/db.ts opens its connection at module load, so the env var has
 *  to be in place before the import happens. */
async function boot(): Promise<Accounts> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return (await import("../src/accounts.ts")) as Accounts;
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-")), "app.db");
});

describe("registering", () => {
  it("makes an account that can then be signed into", async () => {
    const accounts = await boot();
    expect(accounts.createAccount("An", "a good long passphrase", "canberra")).toBe(null);
    expect(accounts.verifyPassword("An", "a good long passphrase")).toBe(true);
  });

  it("refuses a name somebody already has, rather than overwriting them", async () => {
    const accounts = await boot();
    expect(accounts.createAccount("An", "the first passphrase", "canberra")).toBe(null);
    // The whole point of a name being the identity: the second An must not
    // silently become the first An, and must not take their password away.
    expect(accounts.createAccount("An", "a different passphrase", "hanoi")).toBe("name-taken");
    expect(accounts.verifyPassword("An", "the first passphrase")).toBe(true);
    expect(accounts.verifyPassword("An", "a different passphrase")).toBe(false);
  });

  it("refuses a blank name and a blank password in words", async () => {
    const accounts = await boot();
    expect(accounts.createAccount("   ", "a good long passphrase", "canberra")).toBe("blank-name");
    expect(accounts.createAccount("An", "", "canberra")).toBe("blank-password");
  });

  it("refuses a password too short to be worth hashing", async () => {
    const accounts = await boot();
    // Not a policy about symbols and digits, which teaches people to write
    // the password down. Just long enough that it is not "1234".
    expect(accounts.createAccount("An", "short", "canberra")).toBe("password-too-short");
  });

  it("refuses a household that is not a house in this village", async () => {
    const accounts = await boot();
    expect(accounts.createAccount("An", "a good long passphrase", "narnia")).toBe("unknown-house");
  });

  it("lets somebody register with no household at all, as a guest everywhere", async () => {
    const accounts = await boot();
    // Somebody with no code is still a real person with a real account.
    // This is the marker, and anybody the family sends the URL to.
    expect(accounts.createAccount("Visitor", "a good long passphrase", null)).toBe(null);
    expect(accounts.householdOf("Visitor")).toBe(null);
  });

  it("remembers which household an account belongs to", async () => {
    const accounts = await boot();
    accounts.createAccount("An", "a good long passphrase", "canberra");
    expect(accounts.householdOf("An")).toBe("canberra");
  });
});

describe("signing in", () => {
  it("refuses the wrong password, and refuses a name that was never registered", async () => {
    const accounts = await boot();
    accounts.createAccount("An", "a good long passphrase", "canberra");
    expect(accounts.verifyPassword("An", "not the passphrase")).toBe(false);
    expect(accounts.verifyPassword("Nobody", "a good long passphrase")).toBe(false);
  });

  it("never stores the password itself, only a salted hash of it", async () => {
    const accounts = await boot();
    const secret = "a good long passphrase";
    accounts.createAccount("An", secret, "canberra");
    accounts.createAccount("Mum", secret, "nghe-an");

    // Read the column directly: this is the must-never, so it is asserted
    // against the stored bytes rather than against an accessor that could
    // be hiding the problem.
    const stored = accounts.storedPasswordFor("An");
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(secret);
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]{128}$/);

    // Two accounts with the SAME password must not share a hash, or the
    // database tells you who reused one.
    expect(accounts.storedPasswordFor("Mum")).not.toBe(stored);
  });
});
