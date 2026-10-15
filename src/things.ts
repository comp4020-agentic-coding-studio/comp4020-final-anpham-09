import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { nameOf } from "./people.ts";

export interface Perspective {
  author: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ThingView {
  id: number;
  title: string;
  body: string;
  eventDate: string | null;
  placedBy: string;
  placedByName: string;
  createdAt: string;
  perspectives: Perspective[];
  /** Everyone other than the placer who wrote a perspective and explicitly
   *  chose "Keep this together". Never includes the placer: that is the
   *  whole product. */
  keeperNames: string[];
  onShelf: boolean;
  isOwn: boolean;
  viewerHasKept: boolean;
  viewerHasPerspective: boolean;
}

export type PlaceRefusal = "unknown-house" | "blank-title" | "blank-body";
export type PerspectiveRefusal = "unknown-thing" | "blank-body";
export type KeepRefusal = "unknown-thing" | "own-thing" | "already" | "no-perspective" | null;

/** Placing is not keeping. The thing goes into the room either way, as the
 *  creator's own record of it — IN_ROOM. It becomes a shared memory only
 *  once a distinct second member writes a perspective and explicitly keeps
 *  it together (see keepTogether below). Nothing is withheld — an unkept
 *  thing stays visible forever. */
export function place(
  houseSlug: string,
  placedBy: string,
  title: string,
  body: string,
  eventDate?: string,
): number | PlaceRefusal {
  const trimmedTitle = title.trim().slice(0, 120);
  const trimmedBody = body.trim().slice(0, 280);
  if (!trimmedTitle) return "blank-title";
  if (!trimmedBody) return "blank-body";
  const house = houseBySlug(houseSlug);
  if (!house) return "unknown-house";

  const trimmedDate = eventDate?.trim().slice(0, 40) || null;
  const info = db
    .prepare(
      "INSERT INTO things (house_id, placed_by, title, body, event_date) VALUES (?, ?, ?, ?, ?)",
    )
    .run(house.id, placedBy, trimmedTitle, trimmedBody, trimmedDate);
  return Number(info.lastInsertRowid);
}

/** A genuine written perspective — the precondition "Keep this together"
 *  requires. Append-only: never overwrites the original story or another
 *  person's perspective. The creator may add one too; it still does not make
 *  them a keeper of their own thing (keepings_not_own still applies). */
export function addPerspective(
  thingId: number,
  author: string,
  body: string,
): number | PerspectiveRefusal {
  const trimmed = body.trim().slice(0, 280);
  if (!trimmed) return "blank-body";
  const thing = db.prepare("SELECT id FROM things WHERE id = ?").get(thingId);
  if (!thing) return "unknown-thing";
  const info = db
    .prepare("INSERT INTO perspectives (thing_id, author, body) VALUES (?, ?, ?)")
    .run(thingId, author, trimmed);
  return Number(info.lastInsertRowid);
}

/** The explicit "Keep this together" action — the only path to ON_SHELF.
 *  Requires the person to have already written a perspective (checked here,
 *  and again by the keepings_require_perspective trigger), and that they are
 *  not the placer (checked here, and again by keepings_not_own) — each
 *  invariant enforced twice on purpose, same pattern as the original
 *  own-thing rule. */
export function keepTogether(thingId: number, person: string): KeepRefusal {
  const thing = db.prepare("SELECT placed_by FROM things WHERE id = ?").get(thingId) as
    | { placed_by: string }
    | undefined;
  if (!thing) return "unknown-thing";
  if (thing.placed_by === person) return "own-thing";
  const existing = db
    .prepare("SELECT 1 FROM keepings WHERE thing_id = ? AND person = ?")
    .get(thingId, person);
  if (existing) return "already";
  const hasPerspective = db
    .prepare("SELECT 1 FROM perspectives WHERE thing_id = ? AND author = ?")
    .get(thingId, person);
  if (!hasPerspective) return "no-perspective";
  try {
    db.prepare("INSERT INTO keepings (thing_id, person) VALUES (?, ?)").run(thingId, person);
  } catch (err: unknown) {
    // The schema enforces all three of these too, and a lost race must still
    // come back as a reason rather than as a stack trace.
    const message = String(err);
    if (message.includes("UNIQUE")) return "already";
    if (message.includes("cannot be kept by whoever placed it")) return "own-thing";
    if (message.includes("must have written a perspective")) return "no-perspective";
    throw err;
  }
  return null;
}

function viewsFor(houseSlug: string, viewer: string, shelfOnly: boolean): ThingView[] {
  const house = houseBySlug(houseSlug);
  if (!house) return [];
  const rows = db
    .prepare(
      `SELECT t.id, t.title, t.body, t.event_date AS eventDate,
              t.placed_by AS placedBy, t.created_at AS createdAt
         FROM things t
        WHERE t.house_id = ?
        ORDER BY t.id DESC
        LIMIT 200`,
    )
    .all(house.id) as Array<{
    id: number;
    title: string;
    body: string;
    eventDate: string | null;
    placedBy: string;
    createdAt: string;
  }>;

  const keepers = db.prepare("SELECT person FROM keepings WHERE thing_id = ? ORDER BY id");
  const perspectivesFor = db.prepare(
    "SELECT author, body, created_at AS createdAt FROM perspectives WHERE thing_id = ? ORDER BY id",
  );

  const views = rows.map((r) => {
    const people = keepers.all(r.id).map((k) => (k as { person: string }).person);
    const perspectives = (
      perspectivesFor.all(r.id) as Array<{ author: string; body: string; createdAt: string }>
    ).map((p) => ({ ...p, authorName: nameOf(p.author) }));
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      eventDate: r.eventDate,
      placedBy: r.placedBy,
      placedByName: nameOf(r.placedBy),
      createdAt: r.createdAt,
      perspectives,
      keeperNames: people.map(nameOf),
      // Derived, never stored: a thing is kept iff somebody else's name is
      // on it, so the label cannot drift from the fact underneath it.
      onShelf: people.length > 0,
      isOwn: r.placedBy === viewer,
      viewerHasKept: people.includes(viewer),
      viewerHasPerspective: perspectives.some((p) => p.author === viewer),
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
