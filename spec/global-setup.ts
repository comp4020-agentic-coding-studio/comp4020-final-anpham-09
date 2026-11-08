import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

/** How long to wait for a server to start answering: 300 tries, 200ms apart,
 *  since some stacks take a while to boot or migrate. */
const TRIES = 300;

async function waitFor(baseUrl: string): Promise<boolean> {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      await fetch(baseUrl);
      return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

/** A port nothing is listening on. Asked of the operating system rather than
 *  guessed, because the spec's own server must not collide with the dev
 *  server the author has open on 8080 while they work. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
    });
  });
}

/** The spec checks a RUNNING app over HTTP, so it holds whatever the app is
 *  built with.
 *
 *  `APP_URL` is how CI says "that one": it builds the Dockerfile, starts the
 *  image with a throwaway `/data` and points the spec at it, so what passes
 *  there is what deploys. That path is unchanged.
 *
 *  Without `APP_URL` the spec starts a server of its own, on a free port and
 *  a throwaway database, and stops it afterwards. Two reasons, and the first
 *  is not a convenience:
 *
 *  A household table holds five notes a day, counted per house — so a
 *  database that has already been used today has no room left in it, and
 *  every test that places something is refused for a reason that has nothing
 *  to do with what it was testing. CI never met this, because its `/data` is
 *  a tmpfs. Locally a long-lived `.data/app.db` made the suite pass once a
 *  day. A fresh database per run is the only arrangement in which the cap
 *  and the suite can both be true.
 *
 *  It also retires a footgun this repo has been bitten by three times: with
 *  no watcher, a hand-started server holds the source it booted with, so
 *  editing a file and re-running the spec proved nothing about the edit. A
 *  server started here is always the source on disk.
 *
 *  `pnpm dev` is untouched and still keeps its own database, so the village
 *  you browse is not wiped by running the checks. */
export default async function setup(project: TestProject): Promise<(() => void) | undefined> {
  const given = process.env.APP_URL;
  if (given) {
    if (!(await waitFor(given))) {
      throw new Error(
        `nothing is answering at ${given}: start your app first, or unset APP_URL and the spec will start one`,
      );
    }
    project.provide("baseUrl", given);
    return undefined;
  }

  const dbPath = join(mkdtempSync(join(tmpdir(), "village-spec-")), "app.db");
  const port = await freePort();
  const app = spawn(process.execPath, ["src/server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: dbPath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Kept so a server that never answers can say why, rather than the suite
  // reporting three hundred refused connections and nothing else.
  let said = "";
  app.stdout?.on("data", (chunk: unknown) => {
    said += String(chunk);
  });
  app.stderr?.on("data", (chunk: unknown) => {
    said += String(chunk);
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  if (!(await waitFor(baseUrl))) {
    app.kill("SIGKILL");
    throw new Error(`the spec's own server never answered at ${baseUrl}:\n${said}`);
  }

  project.provide("baseUrl", baseUrl);
  return () => {
    app.kill("SIGTERM");
    // An open SSE stream can hold the process past a polite signal, and a
    // throwaway server has nothing worth shutting down cleanly for.
    setTimeout(() => app.kill("SIGKILL"), 2000).unref();
  };
}
