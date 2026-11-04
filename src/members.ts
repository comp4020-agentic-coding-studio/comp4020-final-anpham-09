import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Which house you belong to, and who is a guest in it.
//
// A household code is what proves you live somewhere. It is one code per
// HOUSE, not per person: the two adults in Nghe An share theirs the way two
// people living somewhere share a front-door key, and a code that belongs to
// a household is a thing a household can pass on without the app brokering
// it. Three codes, not five.
//
// It is used exactly once, at registration, to decide whether an account may
// claim a household. After that the account carries the household and the
// code is never asked for again — it is not a password, and signing in never
// involves it.
//
// Registering without a code is allowed: you get a real account that belongs
// to no house, which makes you a guest everywhere. The app is on a public
// URL, so this is the setting that decides whether a stranger who finds it
// can write in the family's homes. Without the codes they could.
//
// The codes never live in this repository, which is public. They are scrypt
// hashes held in one Fly secret, HOUSEHOLD_CODES, read once at boot, keyed by
// house slug:
//
//   {"nghe-an":"<salt>:<hash>", "hanoi":"<salt>:<hash>", ...}
//
// `pnpm household-code "nghe-an"` prints one entry, taking the code on stdin.
// An Duy is eleven months old and has no account: he is who the village is
// for, not someone who uses it.

const KEYLEN = 64;

export function hashKey(key: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(key, salt, KEYLEN).toString("hex")}`;
}

/** Whether a secret matches a stored salt-and-hash. Exported because
 *  accounts.ts verifies passwords with exactly this comparison, and a second
 *  copy of a timing-safe check is a second chance to get one subtly wrong. */
export function matches(key: string, stored: string): boolean {
  const [salt, want] = stored.split(":");
  if (!salt || !want) return false;
  const got = scryptSync(key, salt, KEYLEN);
  const expected = Buffer.from(want, "hex");
  // Lengths must match before timingSafeEqual, and comparing this way rather
  // than with === keeps a wrong key from being distinguishable by how long
  // the answer took.
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** An entry is a salt and a scrypt hash, both hex, as hashKey writes them.
 *  Anything else cannot verify any code and never will, so it is not a code. */
const WELL_FORMED = new RegExp(`^[0-9a-f]+:[0-9a-f]{${KEYLEN * 2}}$`);

/** Entries that were present but unusable, for the server to say out loud at
 *  boot. Collected rather than logged here so this module stays testable
 *  without capturing console output. */
const problems: string[] = [];

/** house slug -> stored hash. Empty when HOUSEHOLD_CODES is unset, which is
 *  the correct state for a fresh checkout and for CI: no house can be
 *  claimed, everybody who registers is a guest everywhere, and no test needs
 *  a secret to run. */
function loadCodes(): Map<string, string> {
  const raw = process.env.HOUSEHOLD_CODES;
  if (!raw) return new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
  } catch (err) {
    // Failing loudly here is right: a malformed secret would otherwise mean
    // every household silently becomes unclaimable, which looks like the app
    // working rather than the app misconfigured.
    throw new Error(`HOUSEHOLD_CODES is set but could not be read: ${String(err)}`);
  }
  const good = new Map<string, string>();
  for (const [slug, stored] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof stored === "string" && WELL_FORMED.test(stored)) {
      good.set(slug, stored);
      continue;
    }
    // A value that parses but is not a hash — a placeholder left in, a hash
    // truncated by a wrapped paste — would otherwise count towards codesCut()
    // and make a household unclaimable while appearing configured. It is
    // dropped, and named, instead.
    problems.push(slug);
  }
  return good;
}

/** The houses whose entries were unusable. Empty when the secret is good. */
export function codeProblems(): string[] {
  return [...problems];
}

const codes = loadCodes();

/** The houses that have a code cut for them. */
export function housesWithCodes(): string[] {
  return [...codes.keys()];
}

/** Whether this code admits somebody to this household. Every wrong code
 *  costs the same work as a right one, and no answer says which half was
 *  wrong. */
export function codeOpens(houseSlug: string, code: string): boolean {
  const stored = codes.get(houseSlug);
  if (!stored) {
    // Still do the work, so a house with a code and one without take about
    // the same time to refuse.
    hashKey(code);
    return false;
  }
  return matches(code, stored);
}

export function codesCut(): number {
  return codes.size;
}

/** Whether a house may be claimed at all. A village with no codes cut lets
 *  anyone claim any household, which is the honest reading of a door with no
 *  lock on it, and keeps a missing secret from making the app unusable for
 *  the family rather than merely open. Once a single code exists, a house
 *  that has one requires it. */
export function householdNeedsCode(houseSlug: string): boolean {
  return codes.has(houseSlug);
}

// Two rules where there was one.
//
// `mayChange` used to answer three different questions at once — may you see
// this room, may you start something in it, may you respond to what is here
// — and the three have to differ now. Both of these are pure functions with
// no I/O, so they are tested directly rather than inferred from an HTTP
// round trip, the same reason the old one was.

/** May this person START something here: put a thing down that nobody has
 *  mentioned yet?
 *
 *  Your own household, or the meeting house, which belongs to nobody and is
 *  open to everyone. Not somebody else's home.
 *
 *  This is a deliberate reversal. The rule used to be that any member could
 *  change any home — "the family is one family, however many cities it is
 *  in" — which was true of a village where a key meant "one of us". With
 *  registration open to anyone who has the URL, "a member" no longer means
 *  "family", and a home needs to be its household's own. */
export function mayPlace(houseKind: "home" | "meeting", household: string | null, houseSlug: string): boolean {
  if (houseKind === "meeting") return true;
  return household === houseSlug;
}

/** May this person RESPOND to something already here: write their side of
 *  it, keep it together?
 *
 *  Anybody signed in, in any house. This is not a loosening for its own
 *  sake — it is what makes the shelf rule reachable at all for a household
 *  of one. An lives alone in Canberra. A thing reaches a shelf only when a
 *  second person writes their perspective and keeps it; if a guest could not
 *  do that, nothing An ever placed at home could reach his own shelf, and
 *  the rule this whole app is built on would hold for everyone except him. */
export function mayRespond(signedIn: boolean): boolean {
  return signedIn;
}
