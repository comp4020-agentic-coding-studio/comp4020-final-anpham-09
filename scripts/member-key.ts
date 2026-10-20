// Prints one entry for the MEMBER_KEYS secret. The key never leaves this
// machine and is never written to a file: what comes out is a scrypt hash,
// which cannot be turned back into the key.
//
//   pnpm member-key "Mum" "the key she chose"
//
// Collect the entries into one JSON object and set it as a single secret:
//
//   flyctl secrets set MEMBER_KEYS='{"Mum":"...","Dad":"..."}' -a comp4020-final-anpham-09
//
// Setting the secret restarts the machine, which is when the village stops
// being open to everyone. An Duy has no key.

import { hashKey } from "../src/members.ts";

const [name, key] = process.argv.slice(2);

if (!name || !key) {
  console.error('usage: pnpm member-key "<name>" "<key>"');
  process.exit(1);
}

// Printed as its own JSON fragment rather than a bare hash, so pasting the
// entries together is copying, not retyping — a mistyped hash would silently
// make that person a visitor.
console.log(`${JSON.stringify(name)}:${JSON.stringify(hashKey(key))}`);
