import { db } from "./db.ts";

export interface House {
  id: number;
  slug: string;
  name: string;
  kind: "home" | "meeting";
}

/** Houses are seeded furniture, not content: the app never adds a fifth. */
export function listHouses(): House[] {
  return db.prepare("SELECT id, slug, name, kind FROM houses ORDER BY id").all() as House[];
}

export function houseBySlug(slug: string): House | undefined {
  return db.prepare("SELECT id, slug, name, kind FROM houses WHERE slug = ?").get(slug) as
    | House
    | undefined;
}
