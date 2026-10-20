import { createHash } from "node:crypto";
import type { Person } from "./people.ts";

// One structured line per thing a person does, on stdout, where Fly collects
// it: `mise exec -- flyctl logs -a comp4020-final-anpham-09` is the whole
// reading apparatus. The point of this file is that someone watching the log
// can say who did what without touching the app.
//
// The log must identify a person without leaking what authenticates them.
// The cookie token IS the credential — anyone who could read it from a log
// could become that person — so it never appears here. Instead each person
// gets a short, stable id derived from it: enough to follow one person across
// a session and tell two apart, useless for impersonating either.

const idCache = new Map<string, string>();

/** A stable, non-reversible short id for a token. Same person, same id, for
 *  as long as their cookie lasts; nothing in it can be turned back into the
 *  cookie. */
export function actorId(token: string): string {
  const cached = idCache.get(token);
  if (cached) return cached;
  const id = createHash("sha256").update(token).digest("hex").slice(0, 8);
  idCache.set(token, id);
  return id;
}

export interface Actor {
  /** Short derived id — never the token itself. */
  id: string;
  /** The name they chose, or null for someone who has not said who they are. */
  name: string | null;
}

export function actor(person: Person | undefined, token: string | undefined): Actor {
  if (person) return { id: actorId(person.token), name: person.name };
  return { id: token ? actorId(token) : "anonymous", name: null };
}

/** Everything a reader of the log needs: when, who, what they did, and where.
 *  `detail` carries whatever is specific to the action and must never hold a
 *  token, a cookie or anything else that would let a reader act as them. */
export function logAction(
  action: string,
  who: Actor,
  detail: Record<string, string | number | boolean | null> = {},
): void {
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      level: "info",
      action,
      who: who.id,
      name: who.name,
      ...detail,
    }),
  );
}
