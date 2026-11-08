import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { hashKey, matches } from "./members.ts";

// An account is a name, a password and the household you belong to.
//
// This is a real account where the key it replaced was not: it is who you
// are, the same person on every device, rather than permission attached to
// a browser. What it still is not is a profile. There is no email, no
// avatar, no analytics and nothing to recover — if a password is forgotten
// the family makes another account, because the alternative is an address
// to send a reset to, and the app collects no addresses.
//
// Registering with no household code is allowed and gives a real account
// with no household: a guest in every house. That is the honest shape for
// somebody the family sent the URL to.

/** Why an account could not be made. Every one of these reaches the person
 *  as a sentence — a refusal the app will not explain is the failure this
 *  app exists to avoid. */
export type RegisterRefusal =
  | "blank-name"
  | "blank-password"
  | "password-too-short"
  | "unknown-house"
  | "name-taken";

/** Long enough not to be guessed in an afternoon, with no rule about digits
 *  or symbols. Those rules push people towards one capital, one digit and a
 *  sticky note; length is the part that actually costs an attacker. */
const MIN_PASSWORD = 8;

const NAME_MAX = 40;

/** Make an account. Returns null on success, or the reason it was refused. */
export function createAccount(
  name: string,
  password: string,
  household: string | null,
): RegisterRefusal | null {
  const trimmed = name.trim().slice(0, NAME_MAX);
  if (!trimmed) return "blank-name";
  // The password is NOT trimmed. A space is a character somebody may have
  // meant, and silently hashing something other than what was typed means
  // the password works today and fails on a machine that trims differently.
  if (!password) return "blank-password";
  if (password.length < MIN_PASSWORD) return "password-too-short";
  if (household !== null && !houseBySlug(household)) return "unknown-house";

  // Asked before inserting so the refusal is a sentence rather than a
  // constraint error. The PRIMARY KEY below is still the thing that makes it
  // true — this check can race, the key cannot — which is why the insert is
  // also guarded. Same belt-and-braces as the own-thing rule.
  //
  // Deleting this line alone changes no behaviour and no test goes red: the
  // key catches the duplicate and the catch returns the same refusal. That
  // was measured, not assumed. It is redundancy on purpose, not a line
  // nobody noticed — both layers had to go before the spec complained.
  if (db.prepare("SELECT 1 FROM accounts WHERE name = ?").get(trimmed)) return "name-taken";

  try {
    db.prepare("INSERT INTO accounts (name, password, household) VALUES (?, ?, ?)")
      .run(trimmed, hashKey(password), household);
  } catch {
    // The only way to get here is the PRIMARY KEY: somebody registered this
    // name between the check above and this insert.
    return "name-taken";
  }
  return null;
}

/** Whether this password opens this account. False for an account that does
 *  not exist, and it costs the same work either way: answering a wrong name
 *  faster than a wrong password tells an attacker which names are real. */
export function verifyPassword(name: string, password: string): boolean {
  const row = db.prepare("SELECT password FROM accounts WHERE name = ?").get(name.trim()) as
    | { password: string }
    | undefined;
  if (!row) {
    hashKey(password);
    return false;
  }
  return matches(password, row.password);
}

/** The household this account belongs to, or null for a guest everywhere.
 *  Also null for an account that does not exist — a name nobody registered
 *  belongs to no house, which is the same answer either way. */
export function householdOf(name: string): string | null {
  const row = db.prepare("SELECT household FROM accounts WHERE name = ?").get(name.trim()) as
    | { household: string | null }
    | undefined;
  return row?.household ?? null;
}

/** Whether this name has been registered. */
export function accountExists(name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM accounts WHERE name = ?").get(name.trim()));
}

/** The stored salt-and-hash, for the test that asserts a password is never
 *  stored. Exported for that assertion specifically: the rule is worth
 *  checking against the bytes in the column rather than against an accessor
 *  that could be hiding the very thing being asked about. */
export function storedPasswordFor(name: string): string | undefined {
  const row = db.prepare("SELECT password FROM accounts WHERE name = ?").get(name.trim()) as
    | { password: string }
    | undefined;
  return row?.password;
}

/** Why a password could not be changed. Shares two members with
 *  RegisterRefusal deliberately: the length rule is the same rule, and a
 *  password that would be refused at registration must not be settable
 *  through a side door. */
export type SetPasswordRefusal = "blank-password" | "password-too-short" | "no-such-account";

/** Replace the password on an account that already exists.
 *
 *  This is NOT account recovery, and there is deliberately no route to it:
 *  the app collects no email, so there is nobody to prove a request came
 *  from. It is a hand tool, run on the machine by whoever already has the
 *  database — which is the only person who could have changed the column
 *  with sqlite3 anyway. Writing it down as a script makes that operation
 *  hashed, length-checked and testable rather than a hand-rolled UPDATE.
 *
 *  Only the password column moves. The household stays, and nothing the
 *  account placed is touched: identity is the name, so every memory,
 *  perspective and keeping still points at the same person afterwards. */
export function setPassword(name: string, password: string): SetPasswordRefusal | null {
  const trimmed = name.trim();
  // Same order and the same rules as createAccount: a password refused at
  // registration must not be acceptable here.
  if (!password) return "blank-password";
  if (password.length < MIN_PASSWORD) return "password-too-short";
  if (!accountExists(trimmed)) return "no-such-account";

  db.prepare("UPDATE accounts SET password = ? WHERE name = ?").run(hashKey(password), trimmed);
  return null;
}
