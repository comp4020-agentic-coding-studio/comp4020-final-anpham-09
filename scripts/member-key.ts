// Prints one entry for the MEMBER_KEYS secret. The key arrives on stdin:
//
//   read -rs "k?Mum's key: " && printf '%s' "$k" | pnpm -s member-key "Mum"; unset k
//
// The key is never an argument. A command-line argument is visible to every
// other process on the machine through `ps`, pnpm echoes the command it runs,
// and the shell records it in history — three ways for a key to leak before it
// is ever hashed. Reading it on stdin avoids all three, and zsh's `read -rs`
// keeps it off the screen and out of history on the way in.
//
// Nothing here writes the key anywhere. What it prints is a scrypt hash, which
// cannot be turned back into the key.
//
// Collect the entries into one JSON object and set it as a single secret:
//
//   flyctl secrets set MEMBER_KEYS='{"Mum":"...","Dad":"..."}' -a comp4020-final-anpham-09
//
// Setting the secret restarts the machine, which is when the village stops
// being open to everyone. An Duy has no key.

import { hashKey } from "../src/members.ts";

const name = process.argv[2];

const usage = [
  'usage: read -rs "k?<name>\'s key: " && printf \'%s\' "$k" | pnpm -s member-key "<name>"; unset k',
  "",
  "The key is typed in, not passed as an argument, so that it stays out of",
  "`ps`, the terminal and your shell history.",
].join("\n");

if (!name) {
  console.error(usage);
  process.exit(1);
}

// Waiting on a terminal would look like the script working while it silently
// did nothing, so say what to do instead of hanging.
if (process.stdin.isTTY) {
  console.error(`no key on stdin — nothing was made.\n\n${usage}`);
  process.exit(1);
}

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
// Only the trailing newline goes: a key is allowed to contain spaces, and
// trimming it would hash something other than what was typed.
const key = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");

if (!key) {
  console.error("the key was empty, so nothing was made.");
  process.exit(1);
}

// Printed as its own JSON fragment rather than a bare hash, so collecting the
// entries is copying rather than retyping — a mistyped hash would quietly
// make that person a visitor instead of failing.
console.log(`${JSON.stringify(name)}:${JSON.stringify(hashKey(key))}`);
