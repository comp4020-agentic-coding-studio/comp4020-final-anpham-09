import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";

export interface Person {
  token: string;
  name: string;
  homeSlug: string;
  /** The household name this person proved with a key, or null if visiting.
   *  Membership is about what you may change, never what you may see. */
  memberName: string | null;
}

/** Why a person could not be recorded, or the person. Corroborated's habit:
 *  a refusal the app won't explain is the failure the app exists to avoid. */
export type PersonRefusal = "unknown-house" | "blank-name";

export function ensurePerson(
  token: string,
  name: string,
  homeSlug: string,
): Person | PersonRefusal {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return "blank-name";
  if (!houseBySlug(homeSlug)) return "unknown-house";
  db.prepare(
    `INSERT INTO people (token, name, home_slug) VALUES (?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET name = excluded.name, home_slug = excluded.home_slug`,
  ).run(token, trimmed, homeSlug);
  return { token, name: trimmed, homeSlug, memberName: getPerson(token)?.memberName ?? null };
}

export function getPerson(token: string): Person | undefined {
  const row = db
    // member_name belongs in this list. It is read on every request to decide
    // what a person may see and change, and leaving it out meant a key could
    // be accepted, written, and then forgotten by the very next page load —
    // the row said Mum, every page after it said visitor.
    .prepare("SELECT token, name, home_slug AS homeSlug, member_name AS memberName FROM people WHERE token = ?")
    .get(token) as Person | undefined;
  return row;
}

/** An unnamed token is "someone". The app does not invent a name for a person
 *  who has not given one. */
export function nameOf(token: string): string {
  return getPerson(token)?.name ?? "someone";
}

/** Record that this token proved a household key. Idempotent: proving the
 *  same key twice changes nothing. */
export function setMember(token: string, memberName: string): void {
  db.prepare("UPDATE people SET member_name = ? WHERE token = ?").run(memberName, token);
}

/** Sign this session out: the account lets go of the browser.
 *
 *  Clearing the cookie is not enough on its own. The row keeps the token as
 *  its primary key, so anybody replaying the old cookie value — a copy in a
 *  log, a shared machine, a browser's history — lands back on a row that
 *  still names an account and is signed straight back in, with no password
 *  asked for. That was invisible while a key was per-browser; with accounts
 *  it is the difference between signing out and appearing to.
 *
 *  The row itself stays. It carries the name and home this session chose,
 *  and nothing anybody placed may be deleted. */
export function clearMember(token: string): void {
  db.prepare("UPDATE people SET member_name = NULL WHERE token = ?").run(token);
}

export function isMember(person: Person | undefined): boolean {
  return Boolean(person?.memberName);
}

/** Who a request acts as. The cookie is a session; this is the person.
 *
 *  A member is the same person on every device they sign in on, which is
 *  what makes the shelf rule and the game's two chairs true of humans
 *  rather than of browsers. A visitor is still their own browser, which is
 *  the honest answer for somebody who has not said who they are: two
 *  strangers who both typed "Linh" are not one person.
 *
 *  The prefixes matter. Without them a visitor whose cookie happened to read
 *  "Mum" would be the member Mum, and a bare value could not be told apart
 *  from a row written before accounts existed. */
export function personId(person: Person | undefined, token: string): string {
  return person?.memberName ? `m:${person.memberName}` : `v:${token}`;
}

/** The name to show for a person id, from either kind. An id with no
 *  prefix is a row written before accounts existed and is read as a
 *  visitor, so an un-migrated database shows names rather than ids. */
export function nameForPersonId(id: string): string {
  if (id.startsWith("m:")) return id.slice(2);
  const token = id.startsWith("v:") ? id.slice(2) : id;
  return getPerson(token)?.name ?? "someone";
}

/** What to call somebody on their own screen. A member is their account
 *  name: the key says who you are, so the page must not call you something
 *  else on the strength of a text box. */
export function displayName(person: Person | undefined): string {
  return person?.memberName ?? person?.name ?? "someone";
}
