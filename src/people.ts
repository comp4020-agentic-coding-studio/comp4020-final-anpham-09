import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";

export interface Person {
  token: string;
  name: string;
  homeSlug: string;
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
  return { token, name: trimmed, homeSlug };
}

export function getPerson(token: string): Person | undefined {
  const row = db
    .prepare("SELECT token, name, home_slug AS homeSlug FROM people WHERE token = ?")
    .get(token) as Person | undefined;
  return row;
}

/** An unnamed token is "someone". The app does not invent a name for a person
 *  who has not given one. */
export function nameOf(token: string): string {
  return getPerson(token)?.name ?? "someone";
}
