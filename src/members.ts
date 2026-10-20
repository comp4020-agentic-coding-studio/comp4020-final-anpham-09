import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Who lives here, and who is only visiting.
//
// This is not an account system. There is no sign-up, no email, no profile and
// nothing to recover: a member is someone who knows the key to a house, the
// way a key on a ring says you live somewhere. A visitor needs nothing at all
// and is never asked.
//
// The keys never live in this repository, which is public. They are scrypt
// hashes held in one Fly secret, MEMBER_KEYS, read once at boot:
//
//   {"Mum":"<salt>:<hash>", "Dad":"<salt>:<hash>", ...}
//
// `pnpm member-key "Mum" "their key"` prints one entry. An Duy is eleven
// months old and has no key: he is who the village is for, not someone who
// uses it.

const KEYLEN = 64;

export function hashKey(key: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(key, salt, KEYLEN).toString("hex")}`;
}

function matches(key: string, stored: string): boolean {
  const [salt, want] = stored.split(":");
  if (!salt || !want) return false;
  const got = scryptSync(key, salt, KEYLEN);
  const expected = Buffer.from(want, "hex");
  // Lengths must match before timingSafeEqual, and comparing this way rather
  // than with === keeps a wrong key from being distinguishable by how long
  // the answer took.
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** name -> stored hash. Empty when MEMBER_KEYS is unset, which is the correct
 *  state for a fresh checkout and for CI: nobody is a member, everybody can
 *  still visit, and no test needs a secret to run. */
function loadKeys(): Map<string, string> {
  const raw = process.env.MEMBER_KEYS;
  if (!raw) return new Map();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    return new Map(Object.entries(parsed as Record<string, string>));
  } catch (err) {
    // Failing loudly here is right: a malformed secret would otherwise mean
    // every member silently becomes a visitor, which looks like the app
    // working rather than the app misconfigured.
    throw new Error(`MEMBER_KEYS is set but could not be read: ${String(err)}`);
  }
}

const keys = loadKeys();

export function memberNames(): string[] {
  return [...keys.keys()];
}

/** The member this key belongs to, or null. Every wrong key costs the same
 *  work as a right one, and no answer says which half was wrong. */
export function memberFor(name: string, key: string): string | null {
  const stored = keys.get(name);
  if (!stored) {
    // Still do the work, so a name that exists and one that does not take
    // about the same time to refuse.
    hashKey(key);
    return null;
  }
  return matches(key, stored) ? name : null;
}

/** The whole permission rule, as one function with no I/O so it can be tested
 *  directly rather than inferred from an HTTP round trip.
 *
 *  A village with no keys cut is open: nobody is a member, so nobody is a
 *  visitor either, and the app behaves exactly as it did before keys existed.
 *  That keeps a missing secret from locking the family out of their own
 *  houses, and it is the honest reading of a door with no lock on it. Once a
 *  single key exists the distinction is real, and homes close to visitors.
 */
export function mayChange(
  houseKind: "home" | "meeting",
  memberName: string | null,
  keysCut: number,
): boolean {
  if (houseKind === "meeting") return true;
  if (keysCut === 0) return true;
  return memberName !== null;
}

export function keysCut(): number {
  return keys.size;
}
