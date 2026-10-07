import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";

/** How long after a page load the app still believes someone is in a room.
 *  An open event stream refreshes this, so a reader with JavaScript on stays
 *  present; a reader with it off is present for this long and then is not.
 *  This is why the interface says "was here" and never "saw". */
export const PRESENCE_TTL_SECONDS = 45;

const now = (): number => Math.floor(Date.now() / 1000);

export function enter(token: string, houseSlug: string, atEpochSeconds: number = now()): void {
  const house = houseBySlug(houseSlug);
  if (!house) return;
  db.prepare(
    `INSERT INTO presence (person, house_id, last_seen) VALUES (?, ?, ?)
     ON CONFLICT(person) DO UPDATE SET house_id = excluded.house_id, last_seen = excluded.last_seen`,
  ).run(token, house.id, atEpochSeconds);
}

export function leave(token: string): void {
  db.prepare("DELETE FROM presence WHERE person = ?").run(token);
}

export function whoIsIn(houseSlug: string, atEpochSeconds: number = now()): string[] {
  const house = houseBySlug(houseSlug);
  if (!house) return [];
  return db
    .prepare(
      `SELECT person FROM presence
        WHERE house_id = ? AND last_seen > ?
        ORDER BY person`,
    )
    .all(house.id, atEpochSeconds - PRESENCE_TTL_SECONDS)
    .map((r) => (r as { person: string }).person);
}

/** One query for the map, so drawing the village is not four round trips. */
export function whereEveryoneIs(atEpochSeconds: number = now()): Record<string, string[]> {
  const rows = db
    .prepare(
      `SELECT h.slug AS slug, p.person AS person
         FROM presence p JOIN houses h ON h.id = p.house_id
        WHERE p.last_seen > ?
        ORDER BY p.person`,
    )
    .all(atEpochSeconds - PRESENCE_TTL_SECONDS) as Array<{ slug: string; person: string }>;
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.slug] ??= []).push(r.person);
  return out;
}
