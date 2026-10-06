import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// These exercise the rules directly, against a throwaway database, because
// they are about what the app refuses to claim — not about HTTP. src/db.ts
// reads DATABASE_PATH when it is first imported, so each case sets the path
// and then imports, and "restart" is a module reset plus a fresh import,
// which really does close and reopen the file.
type Claims = typeof import("../src/claims.ts");

let dbPath: string;

async function boot(): Promise<Claims> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  return (await import("../src/claims.ts")) as Claims;
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "corroborated-")), "app.db");
});

describe("what the app will and won't claim", () => {
  it("calls a claim nobody else has seen 'asserted'", async () => {
    const c = await boot();
    const id = c.addClaim("The lifts are out", "Marie Reay", "alice");
    const [view] = c.listClaims("alice");
    expect(view.id).toBe(id);
    expect(view.others).toBe(0);
    expect(view.status).toBe("asserted");
  });

  it("calls it 'corroborated' once somebody else says they saw it", async () => {
    const c = await boot();
    const id = c.addClaim("The lifts are out", "Marie Reay", "alice");
    expect(c.addCorroboration(id, "bob")).toBeNull();
    const [view] = c.listClaims("alice");
    expect(view.others).toBe(1);
    expect(view.status).toBe("corroborated");
  });

  it("refuses to let a claim be its own witness", async () => {
    const c = await boot();
    const id = c.addClaim("The lifts are out", "Marie Reay", "alice");
    expect(c.addCorroboration(id, "alice")).toBe("own-claim");
    const [view] = c.listClaims("alice");
    expect(view.others).toBe(0);
    expect(view.status).toBe("asserted");
  });

  it("counts one person once, however many times they say it", async () => {
    const c = await boot();
    const id = c.addClaim("The lifts are out", "Marie Reay", "alice");
    expect(c.addCorroboration(id, "bob")).toBeNull();
    expect(c.addCorroboration(id, "bob")).toBe("already");
    expect(c.listClaims("alice")[0].others).toBe(1);
  });

  it("keeps a claim and its corroborations across a restart", async () => {
    const first = await boot();
    const id = first.addClaim("The lifts are out", "Marie Reay", "alice");
    first.addCorroboration(id, "bob");

    // A genuinely new process would open the same file again. This is the
    // closest the test can get: drop the module graph and re-import, so a
    // fresh Database handle opens the same path.
    const second = await boot();
    const [view] = second.listClaims("alice");
    expect(view.body).toBe("The lifts are out");
    expect(view.others).toBe(1);
    expect(view.status).toBe("corroborated");
  });
});
