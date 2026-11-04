// Prints one entry for the HOUSEHOLD_CODES secret. The code arrives on stdin:
//
//   read -rs "c?Nghe An's code: " && printf '%s' "$c" | pnpm -s household-code "nghe-an"; unset c
//
// The code is never an argument. A command-line argument is visible to every
// other process on the machine through `ps`, pnpm echoes the command it runs,
// and the shell records it in history — three ways for a code to leak before
// it is ever hashed. Reading it on stdin avoids all three, and zsh's `read -rs`
// keeps it off the screen and out of history on the way in.
//
// Nothing here writes the code anywhere. What it prints is a scrypt hash,
// which cannot be turned back into the code.
//
// One code per HOUSE, not per person: the two adults in a household share
// theirs the way two people living somewhere share a front-door key. The
// argument is the house slug — `nghe-an`, `hanoi`, `canberra` — not a name.
//
// Collect the entries into one JSON object and set it as a single secret:
//
//   flyctl secrets set HOUSEHOLD_CODES='{"nghe-an":"...","hanoi":"..."}' -a comp4020-final-anpham-09
//
// Setting the secret restarts the machine, which is when those households
// stop being claimable by anyone who finds the URL. A house with no entry
// stays claimable without a code — see householdNeedsCode in src/members.ts.
// An Duy has no account.

import { hashKey } from "../src/members.ts";

const slug = process.argv[2];

const usage = [
  'usage: read -rs "c?<house>\'s code: " && printf \'%s\' "$c" | pnpm -s household-code "<house-slug>"; unset c',
  "",
  "The house slug is one of: nghe-an, hanoi, canberra.",
  "",
  "The code is typed in, not passed as an argument, so that it stays out of",
  "`ps`, the terminal and your shell history.",
].join("\n");

if (!slug) {
  console.error(usage);
  process.exit(1);
}

// A typo in the slug would produce an entry that guards nothing, while the
// house it was meant for stays claimable by anyone. The houses are fixed
// furniture, so this is checkable rather than a thing to notice later.
const HOUSES = ["nghe-an", "hanoi", "canberra"];
if (!HOUSES.includes(slug)) {
  console.error(`"${slug}" is not a house in this village.\n\n${usage}`);
  process.exit(1);
}

// Waiting on a terminal would look like the script working while it silently
// did nothing, so say what to do instead of hanging.
if (process.stdin.isTTY) {
  console.error(`no code on stdin — nothing was made.\n\n${usage}`);
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
// Only the trailing newline goes: a code is allowed to contain spaces, and
// trimming it would hash something other than what was typed.
const code = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");

if (!code) {
  console.error("the code was empty, so nothing was made.");
  process.exit(1);
}

// Printed as its own JSON fragment rather than a bare hash, so collecting the
// entries is copying rather than retyping — a mistyped hash would quietly
// leave that household unguarded instead of failing.
console.log(`${JSON.stringify(slug)}:${JSON.stringify(hashKey(code))}`);
