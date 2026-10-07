import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { nameOf } from "./people.ts";
import { whoIsIn } from "./presence.ts";

export interface ThingView {
  id: number;
  body: string;
  placedBy: string;
  placedByName: string;
  createdAt: string;
  /** Everyone other than the placer who was in the room, or came later and
   *  took it in. Never includes the placer: that is the whole product. */
  keeperNames: string[];
  onShelf: boolean;
  isOwn: boolean;
  viewerHasKept: boolean;
}

export type PlaceRefusal = "unknown-house" | "blank-body";
export type KeepRefusal = "unknown-thing" | "own-thing" | "already" | null;

/** Placing is not keeping. The thing goes in the room either way; whoever
 *  else was already in the room becomes a keeper, and only then is it a
 *  memory. Nothing is withheld — an unkept thing stays visible forever. */
export function place(
  houseSlug: string,
  placedBy: string,
  body: string,
  atEpochSeconds?: number,
): number | PlaceRefusal {
  const trimmed = body.trim().slice(0, 280);
  if (!trimmed) return "blank-body";
  const house = houseBySlug(houseSlug);
  if (!house) return "unknown-house";

  const info = db
    .prepare("INSERT INTO things (house_id, placed_by, body) VALUES (?, ?, ?)")
    .run(house.id, placedBy, trimmed);
  const id = Number(info.lastInsertRowid);

  const witnesses = whoIsIn(houseSlug, atEpochSeconds).filter((p) => p !== placedBy);
  const keep = db.prepare("INSERT OR IGNORE INTO keepings (thing_id, person) VALUES (?, ?)");
  for (const person of witnesses) keep.run(id, person);
  return id;
}

export function takeIn(thingId: number, person: string): KeepRefusal {
  const thing = db.prepare("SELECT placed_by FROM things WHERE id = ?").get(thingId) as
    | { placed_by: string }
    | undefined;
  if (!thing) return "unknown-thing";
  // Enforced here AND by the keepings_not_own trigger, because a rule that
  // only one of them knows is a rule that can be forgotten.
  if (thing.placed_by === person) return "own-thing";
  const existing = db
    .prepare("SELECT 1 FROM keepings WHERE thing_id = ? AND person = ?")
    .get(thingId, person);
  if (existing) return "already";
  db.prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)").run(thingId, person);
  return null;
}

function viewsFor(houseSlug: string, viewer: string, shelfOnly: boolean): ThingView[] {
  const house = houseBySlug(houseSlug);
  if (!house) return [];
  const rows = db
    .prepare(
      `SELECT t.id, t.body, t.placed_by AS placedBy, t.created_at AS createdAt
         FROM things t
        WHERE t.house_id = ?
        ORDER BY t.id DESC
        LIMIT 200`,
    )
    .all(house.id) as Array<{ id: number; body: string; placedBy: string; createdAt: string }>;

  const keepers = db.prepare("SELECT person FROM keepings WHERE thing_id = ? ORDER BY id");

  const views = rows.map((r) => {
    const people = keepers.all(r.id).map((k) => (k as { person: string }).person);
    return {
      id: r.id,
      body: r.body,
      placedBy: r.placedBy,
      placedByName: nameOf(r.placedBy),
      createdAt: r.createdAt,
      keeperNames: people.map(nameOf),
      // Derived, never stored: a thing is kept iff somebody else's name is
      // on it, so the label cannot drift from the fact underneath it.
      onShelf: people.length > 0,
      isOwn: r.placedBy === viewer,
      viewerHasKept: people.includes(viewer),
    };
  });
  return shelfOnly ? views.filter((v) => v.onShelf) : views;
}

export function inRoom(houseSlug: string, viewer: string): ThingView[] {
  return viewsFor(houseSlug, viewer, false);
}

export function onShelf(houseSlug: string, viewer: string): ThingView[] {
  return viewsFor(houseSlug, viewer, true);
}
