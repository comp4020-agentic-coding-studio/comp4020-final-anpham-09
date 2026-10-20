import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
    // Test files run one at a time, because they are not independent: they
    // share one running app, one database and — the part that actually bites
    // — one meeting-house table with two chairs. Run in parallel, a file that
    // sits down and sows races a file that expects the table as it left it,
    // and the game tests fail perhaps one run in three.
    //
    // Measured rather than guessed: in parallel, four runs of the suite gave
    // 3 failures, 0, 1, 0. Sequential, four runs gave 170 passed every time.
    // A suite that fails one run in three teaches you to re-run it until it
    // is green, which is how a real failure gets waved through — and it gates
    // the deploy, so it would eventually fail one at the worst moment.
    fileParallelism: false,
  },
});
