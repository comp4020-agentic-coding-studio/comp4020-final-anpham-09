import { db } from "./db.ts";
import { nameFor } from "./identity.ts";

export type Status = "asserted" | "corroborated";

export interface ClaimView {
  id: number;
  body: string;
  place: string;
  authorName: string;
  createdAt: string;
  /** How many OTHER people have said they saw it too. Never includes the
   *  author: a claim cannot witness itself. */
  others: number;
  status: Status;
  isOwn: boolean;
  viewerHasCorroborated: boolean;
}

export function addClaim(body: string, place: string, author: string): number {
  const info = db
    .prepare("INSERT INTO claims (body, place, author) VALUES (?, ?, ?)")
    .run(body.trim().slice(0, 280), place.trim().slice(0, 80), author);
  return Number(info.lastInsertRowid);
}

/** Why a corroboration was refused, or null when it was recorded. The caller
 *  shows the reason: a refusal the app won't explain is the failure this app
 *  exists to avoid. */
export type Refusal = "unknown-claim" | "own-claim" | "already" | null;

export function addCorroboration(claimId: number, author: string): Refusal {
  const claim = db.prepare("SELECT author FROM claims WHERE id = ?").get(claimId) as
    | { author: string }
    | undefined;
  if (!claim) return "unknown-claim";
  // You cannot be your own witness. This is the whole point of the app, so it
  // is enforced here AND by UNIQUE(claim_id, author) in the schema.
  if (claim.author === author) return "own-claim";
  const existing = db
    .prepare("SELECT 1 FROM corroborations WHERE claim_id = ? AND author = ?")
    .get(claimId, author);
  if (existing) return "already";
  db.prepare("INSERT INTO corroborations (claim_id, author) VALUES (?, ?)").run(claimId, author);
  return null;
}

export function listClaims(viewer: string): ClaimView[] {
  const rows = db
    .prepare(`
      SELECT c.id, c.body, c.place, c.author, c.created_at AS createdAt,
             (SELECT COUNT(*) FROM corroborations x WHERE x.claim_id = c.id) AS others,
             (SELECT COUNT(*) FROM corroborations x
                WHERE x.claim_id = c.id AND x.author = ?) AS mine
      FROM claims c
      ORDER BY c.id DESC
      LIMIT 100
    `)
    .all(viewer) as Array<{
      id: number; body: string; place: string; author: string;
      createdAt: string; others: number; mine: number;
    }>;

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    place: r.place,
    authorName: nameFor(r.author),
    createdAt: r.createdAt,
    others: r.others,
    // The only two states this app recognises. There is no "verified" and no
    // "true" — a corroborated claim is one more person saying they saw it,
    // which is a different thing and is all the app can show.
    status: r.others > 0 ? "corroborated" : "asserted",
    isOwn: r.author === viewer,
    viewerHasCorroborated: r.mine > 0,
  }));
}

export function getClaim(id: number, viewer: string): ClaimView | undefined {
  return listClaims(viewer).find((c) => c.id === id);
}
