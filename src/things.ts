import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { nameForPersonId } from "./people.ts";
import { isPhotoName } from "./photos.ts";

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
  /** The file name of the one photograph on this thing, or null. Never a
   *  path: see src/photos.ts. */
  photo: string | null;
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
  /** When this thing first reached the shelf — the earliest keeping, not
   *  when it was placed. Null while still IN_ROOM: there is no kept date
   *  until someone has actually kept it. */
  keptAt: string | null;
  isOwn: boolean;
  viewerHasKept: boolean;
  viewerHasPerspective: boolean;
}

export type PlaceRefusal =
  | "unknown-house"
  | "blank-title"
  | "blank-body"
  | "table-full"
  | "photo-unnamed";
export type PerspectiveRefusal = "unknown-thing" | "blank-body";
export type KeepRefusal = "unknown-thing" | "own-thing" | "already" | "no-perspective" | null;

/** Five notes a day on a table — the TABLE's five, not each person's.
 *
 *  A table is a surface. Six people around one do not get thirty notes a
 *  day between them any more than they get thirty plates: what the surface
 *  holds is what it holds, and whoever is there shares it. That is the
 *  point of the number. A per-person five would be a quota, which is a
 *  thing an app gives you, and this is meant to be a thing the room has.
 *
 *  This is a limit on STARTING something and on nothing else. Writing your
 *  side of what is already there, and keeping it together, are never
 *  capped — if they were, a full table could stop a thing from ever being
 *  corroborated, and the one rule this whole app is built on would hold
 *  only on quiet days.
 *
 *  Not counted at all in the meeting house, where what you put down is a
 *  remark in a conversation rather than a note left on a surface. A chat
 *  that took five lines a day would not be a chat.
 */
export const NOTES_A_DAY = 5;

/** The app's day, UTC, spelled the way SQLite spells it.
 *
 *  Which day it is gets asked twice — once to count what you have already
 *  put down, once to decide what is still on the table — and the two
 *  answers have to be the same answer, or a note could be refused for a
 *  day it is not on. So both come from here, and it is the database's clock
 *  rather than Node's, because `created_at` is the database's clock too.
 *
 *  UTC, like every other time in this app. The consequence is real and the
 *  README says it rather than hiding it: the table turns over at 7am in
 *  Nghe An and Hanoi and 11am in Canberra, not at midnight. A local
 *  midnight would need a timezone stored per account, and the app keeps a
 *  name, a password and a household and nothing else. */
export function today(): string {
  return (db.prepare("SELECT date('now') AS day").get() as { day: string }).day;
}

/** How many notes are on this room's table today — everybody's, because
 *  the table is everybody's. */
export function notesToday(houseSlug: string): number {
  const house = houseBySlug(houseSlug);
  if (!house) return 0;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM things
        WHERE house_id = ? AND date(created_at) = ?`,
    )
    .get(house.id, today()) as { n: number };
  return row.n;
}

/** How much room is left on it before the day turns. The meeting house has
 *  no table to fill, so it always has room. */
export function notesLeftToday(houseSlug: string): number {
  const house = houseBySlug(houseSlug);
  if (!house) return 0;
  if (house.kind === "meeting") return NOTES_A_DAY;
  return Math.max(0, NOTES_A_DAY - notesToday(houseSlug));
}

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
  /** A file name that src/photos.ts has already written. Checked again
   *  here, because this is the function every path to a row goes through
   *  and a path in this column would become a path in an img src. */
  photo?: string,
): number | PlaceRefusal {
  const trimmedTitle = title.trim().slice(0, 120);
  const trimmedBody = body.trim().slice(0, 280);
  if (!trimmedBody) return "blank-body";
  // The house is looked up before the title is judged, because whether a
  // title is required depends on which house this is. That is a reordering:
  // a blank title in a house that doesn't exist now answers "unknown-house"
  // rather than "blank-title", which is the more fundamental fact anyway.
  const house = houseBySlug(houseSlug);
  if (!house) return "unknown-house";
  // A thing in a household house needs a name: it can reach that house's
  // shelf, and a kept memory with nothing to call it is hard to come back
  // to. The meeting house is a conversation — a remark at the table is not
  // an artefact and titling it would be a small lie about what it is.
  if (!trimmedTitle && house.kind !== "meeting") return "blank-title";

  // The table holds five a day between everybody. Asked here rather than
  // in the route, so every path that places anything meets it — a
  // hand-made POST and a replayed one included. It is the last question
  // asked, because a note with nothing in it was never going to take up a
  // place on the table anyway.
  if (house.kind !== "meeting" && notesToday(house.slug) >= NOTES_A_DAY) {
    return "table-full";
  }

    const trimmedDate = eventDate?.trim().slice(0, 40) || null;
  const picture = photo?.trim() || null;
  if (picture !== null && !isPhotoName(picture)) return "photo-unnamed";
  const info = db
    .prepare(
      `INSERT INTO things (house_id, placed_by, title, body, event_date, photo)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(house.id, placedBy, trimmedTitle, trimmedBody, trimmedDate, picture);
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
            `SELECT t.id, t.title, t.body, t.event_date AS eventDate, t.photo,
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
    photo: string | null;
    eventDate: string | null;
    placedBy: string;
    createdAt: string;
  }>;

  const keepers = db.prepare(
    "SELECT person, created_at AS keptAt FROM keepings WHERE thing_id = ? ORDER BY id",
  );
  const perspectivesFor = db.prepare(
    "SELECT author, body, created_at AS createdAt FROM perspectives WHERE thing_id = ? ORDER BY id",
  );

  const views = rows.map((r) => {
    const people = keepers.all(r.id) as Array<{ person: string; keptAt: string }>;
    const perspectives = (
      perspectivesFor.all(r.id) as Array<{ author: string; body: string; createdAt: string }>
    ).map((p) => ({ ...p, authorName: nameForPersonId(p.author) }));
    return {
            id: r.id,
      title: r.title,
      body: r.body,
      photo: r.photo,
      eventDate: r.eventDate,
      placedBy: r.placedBy,
      placedByName: nameForPersonId(r.placedBy),
      createdAt: r.createdAt,
      perspectives,
      keeperNames: people.map((p) => nameForPersonId(p.person)),
      // Derived, never stored: a thing is kept iff somebody else's name is
      // on it, so the label cannot drift from the fact underneath it.
      onShelf: people.length > 0,
      // The first keeping is when a thing reached the shelf — later keepers
      // (a third, fourth member) don't move that date.
      keptAt: people.length > 0 ? people[0].keptAt : null,
      isOwn: r.placedBy === viewer,
      viewerHasKept: people.some((p) => p.person === viewer),
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

/** What is on the table: the notes put down in this room today, and
 *  nothing else.
 *
 *  Derived from the day each note already carries, never stored — so there
 *  is no nightly sweep to run, nothing to go wrong if the machine is asleep
 *  at midnight, and no column that could disagree with the timestamp beside
 *  it. The day turns and the table is empty because "was this put down
 *  today" has a new answer, not because anything was moved. Same reasoning
 *  as `onShelf`. */
export function onTable(houseSlug: string, viewer: string): ThingView[] {
  const day = today();
  return inRoom(houseSlug, viewer).filter((t) => t.createdAt.slice(0, 10) === day);
}

export interface NoteDay {
  /** YYYY-MM-DD, UTC. */
  day: string;
  things: ThingView[];
}

/** The note board: every note this room holds, in days, newest day first
 *  and newest note first inside a day.
 *
 *  Today is a day like any other on it. A board that started at yesterday
 *  would be a board you could not trust, and including today is also what
 *  guarantees no note ever exists only on the table — which is what makes
 *  the five-a-day cap a limit on how fast the room fills rather than a way
 *  to lose something.
 *
 *  Grouped here rather than in SQL so that the card a day holds is the same
 *  ThingView the table shows — a board can never disagree with the table
 *  about what a note says or who kept it.
 *
 *  Sorted by day explicitly, rather than leaning on `inRoom`'s id order. In
 *  this app the two agree, because `created_at` is written by the database
 *  at insert and never touched again — but "sorted by date" is what a board
 *  IS, and a board that was only sorted by date because of a coincidence in
 *  another function is a board that could stop being sorted without anybody
 *  touching it. Found by a test that backdated a row. */
export function noteBoard(houseSlug: string, viewer: string): NoteDay[] {
  const byDay = new Map<string, ThingView[]>();
  for (const t of inRoom(houseSlug, viewer)) {
    const day = t.createdAt.slice(0, 10);
    const already = byDay.get(day);
    if (already) already.push(t);
    else byDay.set(day, [t]);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([day, things]) => ({ day, things }));
}

export interface ShelfFilters {
  year?: string;
  q?: string;
}

/** Shelf filtering happens over already-loaded ThingView rows rather than a
 *  second SQL query: the shelf per house is already bounded (LIMIT 200 in
 *  viewsFor), so there's no scale concern, and reusing ThingView keeps the
 *  kept date and perspective text as the single source of truth for what
 *  "matches" means — a filter can never disagree with what the card shows. */
export function shelfFor(houseSlug: string, viewer: string, filters: ShelfFilters): ThingView[] {
  const shelved = onShelf(houseSlug, viewer);
  const year = filters.year?.trim();
  const q = filters.q?.trim().toLowerCase();
  return shelved.filter((t) => {
    if (year && t.keptAt?.slice(0, 4) !== year) return false;
    if (q) {
      const haystack = [t.title, t.body, ...t.perspectives.map((p) => p.body)]
        .join(" \n ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** The years a filter dropdown can offer — only years something has actually
 *  been kept in, so there's never an option that silently returns nothing. */
export function shelfYears(): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT substr(first_kept, 1, 4) AS year FROM (
         SELECT thing_id, MIN(created_at) AS first_kept FROM keepings GROUP BY thing_id
       )
       ORDER BY year DESC`,
    )
    .all() as Array<{ year: string }>;
  return rows.map((r) => r.year);
}

export interface HouseCounts {
  inRoom: number;
  onShelf: number;
}

/** The real counts behind the map's presence row — how many things are still
 *  only in the room versus how many reached the shelf, per house. Counted
 *  directly in SQL rather than through `viewsFor`, since the map needs
 *  numbers for every house at once, not full thing views for one. */
export function countsFor(houseSlug: string): HouseCounts {
  const house = houseBySlug(houseSlug);
  if (!house) return { inRoom: 0, onShelf: 0 };
  const row = db
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM keepings k WHERE k.thing_id = t.id)) AS onShelf,
         COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM keepings k WHERE k.thing_id = t.id)) AS inRoom
       FROM things t WHERE t.house_id = ?`,
    )
    .get(house.id) as { onShelf: number; inRoom: number };
  return { inRoom: row.inRoom, onShelf: row.onShelf };
}

/** The house a thing actually sits in, from the row itself. The form that
 *  asks to change a thing also carries a house slug, but that is the page the
 *  request came from and a caller can say anything — the permission question
 *  has to be answered from the thing, not from the request. */
export function houseOfThing(thingId: number): string | undefined {
  const row = db
    .prepare("SELECT h.slug AS slug FROM things t JOIN houses h ON h.id = t.house_id WHERE t.id = ?")
    .get(thingId) as { slug: string } | undefined;
  return row?.slug;
}
