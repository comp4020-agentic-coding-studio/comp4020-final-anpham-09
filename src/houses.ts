import { readdirSync } from "node:fs";
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

// Houses are fixed and the image files ship inside the container image, so a
// boot-time read of the directory is correct — and it keeps the render path
// free of filesystem calls on every request. Resolved relative to this module
// (not process.cwd(), which differs between `pnpm dev` and the container).
const picturedSlugs = new Set(
  readdirSync(new URL("../img/", import.meta.url))
    .filter((f) => f.endsWith(".jpg"))
    .map((f) => f.slice(0, -4)),
);

/** Whether a house has a photograph on disk to show, as opposed to the
 *  CSS-drawn placeholder. */
export function hasPicture(slug: string): boolean {
  return picturedSlugs.has(slug);
}
