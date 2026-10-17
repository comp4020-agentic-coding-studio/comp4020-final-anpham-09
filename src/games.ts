import { db } from "./db.ts";
import { houseBySlug } from "./houses.ts";
import { nameOf } from "./people.ts";
import {
  type Board,
  type Direction,
  type Side,
  REFILL_COST,
  checkMove,
  decodeBoard,
  encodeBoard,
  finalScore,
  freshBoard,
  isFinished,
  legalPits,
  needsRefill,
  refill,
  sow,
  winnerOf,
} from "./oanquan.ts";

/** The game as the interface needs to see it: the board, who is in which
 *  chair, whose turn it is, and what the viewer is allowed to do. */
export interface GameView {
  id: number;
  board: Board;
  bottom: string;
  bottomName: string;
  top: string | null;
  topName: string | null;
  scores: { bottom: number; top: number };
  turn: Side;
  /** Which chair the viewer is in, or null if they are watching. */
  yourSide: Side | null;
  yourTurn: boolean;
  /** Null while the game is running. */
  ended: "finished" | "stopped" | null;
  /** Only meaningful once `ended` is "finished". */
  winner: Side | "draw" | null;
  final: { bottom: number; top: number } | null;
  /** The pits the viewer may pick up from right now. */
  playable: number[];
  /** The side to move has no stones and must pay before it can play. */
  mustRefill: boolean;
  /** Whether that side can afford to. False means they have lost. */
  canAffordRefill: boolean;
  moveCount: number;
  /** Whether this game can be put down in the room as a thing. True only
   *  for a game that reached its own end, has a real score, and has not
   *  been written down already. A game somebody walked away from produced
   *  no result, and offering to keep it would put a number on something
   *  that never happened; a game already in the room would just be a
   *  second copy of one memory. Either way the button is absent rather
   *  than present-and-refusing. */
  canPlace: boolean;
  /** The side that must refill and cannot afford to, and has therefore
   *  lost — null whenever that is not the situation. The game is still
   *  live at this point: somebody has to say so, which is what
   *  `concede` is for. */
  stuck: Side | null;
}

export type SitRefusal =
  | "unknown-house"
  | "not-the-meeting-house"
  | "chairs-taken"
  | "already-seated";

export type PlayRefusal =
  | "no-game"
  | "not-playing"
  | "not-your-turn"
  | "game-over"
  | "no-direction"
  // Passed straight through from the engine's own checkMove.
  | "no-such-pit"
  | "not-your-pit"
  | "empty-pit"
  | "must-refill"
  | "game-finished";

interface GameRow {
  id: number;
  house_id: number;
  bottom: string;
  top: string | null;
  ended: "finished" | "stopped" | null;
}

interface MoveRow {
  seq: number;
  board_after: string;
  bottom_after: number;
  top_after: number;
  side: Side;
}

const liveGameRow = (houseId: number): GameRow | undefined =>
  db
    .prepare("SELECT id, house_id, bottom, top, ended FROM games WHERE house_id = ? AND ended IS NULL")
    .get(houseId) as GameRow | undefined;

const lastMove = (gameId: number): MoveRow | undefined =>
  db
    .prepare(
      `SELECT seq, board_after, bottom_after, top_after, side
         FROM moves WHERE game_id = ? ORDER BY seq DESC LIMIT 1`,
    )
    .get(gameId) as MoveRow | undefined;

/** Where a game stands: the board and scores after its last move, or the
 *  opening position when nobody has moved yet. Bottom always starts. */
function stateOf(gameId: number): {
  board: Board;
  scores: { bottom: number; top: number };
  turn: Side;
  moveCount: number;
} {
  const last = lastMove(gameId);
  if (!last) {
    return { board: freshBoard(), scores: { bottom: 0, top: 0 }, turn: "bottom", moveCount: 0 };
  }
  const board = decodeBoard(last.board_after);
  if (!board) {
    // A stored board that will not decode is a corrupt row, not a crash:
    // the game is unreadable but the room it sits in is not.
    throw new Error(`game ${gameId}: move ${last.seq} has an unreadable board`);
  }
  return {
    board,
    scores: { bottom: last.bottom_after, top: last.top_after },
    // A refill is part of the refiller's own turn, so the side to move is
    // whoever did NOT make the last move only when that move was a sow.
    // `refillAndMove` always writes the sow too, so this is simply the
    // other side.
    turn: last.side === "bottom" ? "top" : "bottom",
    moveCount: last.seq,
  };
}

/** The game at a house, as the viewer sees it. Null when the table is bare. */
export function gameAt(houseSlug: string, viewer: string): GameView | null {
  const house = houseBySlug(houseSlug);
  if (!house) return null;
  const row = liveGameRow(house.id) ?? lastEndedGame(house.id);
  if (!row) return null;
  return viewOf(row, viewer);
}

/** A table that has been played at shows its last game rather than going
 *  blank: the score is worth seeing, and somebody may want to keep it. */
const lastEndedGame = (houseId: number): GameRow | undefined =>
  db
    .prepare(
      `SELECT id, house_id, bottom, top, ended FROM games
         WHERE house_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(houseId) as GameRow | undefined;

function viewOf(row: GameRow, viewer: string): GameView {
  const { board, scores, turn, moveCount } = stateOf(row.id);
  const yourSide: Side | null =
    row.bottom === viewer ? "bottom" : row.top === viewer ? "top" : null;

  const over = row.ended !== null || isFinished(board);
  const final = over && row.ended !== "stopped" ? finalScore(board, scores) : null;

  const mustRefill = !over && needsRefill(board, turn);
  const canAffordRefill = mustRefill && scores[turn] >= REFILL_COST;
  return {
    id: row.id,
    board,
    bottom: row.bottom,
    bottomName: nameOf(row.bottom),
    top: row.top,
    topName: row.top ? nameOf(row.top) : null,
    scores,
    turn,
    yourSide,
    yourTurn: !over && yourSide === turn && row.top !== null,
    ended: row.ended,
    winner: final ? winnerOf(final) : null,
    final,
    playable: !over && yourSide === turn ? legalPits(board, turn) : [],
    mustRefill,
    canAffordRefill,
    moveCount,
    // A finished game has a score worth keeping. A stopped one has
    // nothing to keep, a live one is not over yet, and one already written
    // down does not want writing down twice.
    canPlace: row.ended === "finished" && !gameIsPlaced(row.id),
    stuck: mustRefill && !canAffordRefill ? turn : null,
  };
}

/** Take a chair. Starts a game if the table is bare, otherwise fills the
 *  empty seat. One person cannot hold both — a game needs two of you. */
export function sitDown(houseSlug: string, person: string): number | SitRefusal {
  const house = houseBySlug(houseSlug);
  if (!house) return "unknown-house";
  // The game belongs to the meeting house. A household house is where you
  // put things down, not where everyone gathers.
  if (house.kind !== "meeting") return "not-the-meeting-house";

  const live = liveGameRow(house.id);
  if (!live) {
    const info = db
      .prepare("INSERT INTO games (house_id, bottom) VALUES (?, ?)")
      .run(house.id, person);
    return Number(info.lastInsertRowid);
  }
  if (live.bottom === person || live.top === person) return "already-seated";
  if (live.top !== null) return "chairs-taken";
  db.prepare("UPDATE games SET top = ? WHERE id = ?").run(person, live.id);
  return live.id;
}

/** Leave the table. Standing up from a game with moves in it ends that
 *  game — see `stopGame`. Standing up from one nobody has played yet just
 *  clears the chair so the table is free again. */
export function standUp(houseSlug: string, person: string): "no-game" | "not-seated" | null {
  const house = houseBySlug(houseSlug);
  if (!house) return "no-game";
  const live = liveGameRow(house.id);
  if (!live) return "no-game";
  if (live.bottom !== person && live.top !== person) return "not-seated";

  const played = lastMove(live.id) !== undefined;
  if (played) {
    markEnded(live.id, "stopped");
    return null;
  }
  if (live.top === person) {
    db.prepare("UPDATE games SET top = NULL WHERE id = ?").run(live.id);
    return null;
  }
  // The person who set the table out is leaving and nothing has been
  // played. If somebody else is sitting, they inherit the table rather
  // than being thrown out of a game that never started.
  if (live.top !== null) {
    db.prepare("UPDATE games SET bottom = top, top = NULL WHERE id = ?").run(live.id);
    return null;
  }
  markEnded(live.id, "stopped");
  return null;
}

/** A move. Writes one `moves` row — or two, when the turn had to start by
 *  refilling, because the refill and the sow are both part of one turn and
 *  both change the board. */
export function play(
  houseSlug: string,
  person: string,
  pit: number,
  direction: Direction,
): PlayRefusal | null {
  const house = houseBySlug(houseSlug);
  if (!house) return "no-game";
  const live = liveGameRow(house.id);
  if (!live) return "no-game";
  if (live.top === null) return "no-game";

  const side: Side | null =
    live.bottom === person ? "bottom" : live.top === person ? "top" : null;
  if (!side) return "not-playing";
  if (direction !== "left" && direction !== "right") return "no-direction";

  const { board, scores, turn, moveCount } = stateOf(live.id);
  if (isFinished(board)) return "game-over";
  if (turn !== side) return "not-your-turn";

  let working = board;
  const after = { ...scores };
  let seq = moveCount;

  // Bù dân: the turn begins by paying five points to refill an empty side.
  // Written as its own move row so the board the family can see always has
  // a move that explains it.
  if (needsRefill(working, side)) {
    if (after[side] < REFILL_COST) {
      // Not a refusal — a loss. The caller ends the game; see `concede`.
      return "must-refill";
    }
    after[side] -= REFILL_COST;
    working = refill(working, side);
    seq += 1;
    insertMove(live.id, seq, side, "refill", null, null, working, after);
  }

  const refused = checkMove(working, side, pit);
  if (refused) return refused;

  const result = sow(working, pit, direction);
  after[side] += result.captured;
  seq += 1;
  insertMove(live.id, seq, side, "sow", pit, direction, result.board, after);

  if (isFinished(result.board)) markEnded(live.id, "finished");
  return null;
}

function insertMove(
  gameId: number,
  seq: number,
  side: Side,
  kind: "sow" | "refill",
  pit: number | null,
  direction: Direction | null,
  board: Board,
  scores: { bottom: number; top: number },
): void {
  db.prepare(
    `INSERT INTO moves (game_id, seq, side, kind, pit, direction, board_after, bottom_after, top_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(gameId, seq, side, kind, pit, direction, encodeBoard(board), scores.bottom, scores.top);
}

/** End a game early. Either player can, and it ends with no result at all:
 *  no score, no winner, nothing to put on a shelf. A game somebody walked
 *  away from did not produce a result, and recording one would put a number
 *  on something that never happened.
 *
 *  This is the same ending `standUp` reaches by a different door — leaving
 *  your chair mid-game ends the game, because there is no one left to play
 *  it. Both funnel through here so there is one place that knows what
 *  "ended early" means. */
export function endGame(houseSlug: string, person: string): "no-game" | "not-playing" | null {
  const house = houseBySlug(houseSlug);
  if (!house) return "no-game";
  const live = liveGameRow(house.id);
  if (!live) return "no-game";
  if (live.bottom !== person && live.top !== person) return "not-playing";
  markEnded(live.id, "stopped");
  return null;
}

/** The third ending, and the one that is easiest to leave out: a player
 *  whose five pits are empty must pay five points to refill them, and a
 *  player who cannot afford that has lost. The family's house rules say so
 *  — "insufficient refill points means loss".
 *
 *  Without this the game is simply stuck. `play` refuses the move, quite
 *  correctly, and goes on refusing it forever; the board sits there with no
 *  legal action for anyone and no way to finish. It happens in roughly one
 *  game in fifty under random play, which is often enough to matter and
 *  rare enough to never see by hand.
 *
 *  Unlike ending early, this DOES produce a score. The board is swept the
 *  same way a naturally finished game is swept, because the position is
 *  real and the points on it were genuinely won — it is only the next move
 *  that is impossible. So it ends as 'finished', and can be kept. */
export function concede(houseSlug: string, person: string): "no-game" | "not-playing" | "not-stuck" | null {
  const house = houseBySlug(houseSlug);
  if (!house) return "no-game";
  const live = liveGameRow(house.id);
  if (!live) return "no-game";
  if (live.bottom !== person && live.top !== person) return "not-playing";
  if (live.top === null) return "no-game";

  const { board, scores, turn } = stateOf(live.id);
  if (isFinished(board)) return "not-stuck";
  // Either player may say it, because both can see it — but only about a
  // side that really is stuck. A player cannot concede their way out of a
  // turn they could still play.
  if (!needsRefill(board, turn) || scores[turn] >= REFILL_COST) return "not-stuck";
  markEnded(live.id, "finished");
  return null;
}

const markEnded = (gameId: number, how: "finished" | "stopped"): void => {
  db.prepare("UPDATE games SET ended = ?, ended_at = datetime('now') WHERE id = ?").run(
    how,
    gameId,
  );
};

export type PlaceGameRefusal =
  | "no-game"
  | "not-playing"
  | "game-not-finished"
  | "already-placed";

/** Put a finished game down in the room, as a thing like any other.
 *
 *  Deliberately NOT automatic. A finished game is not a memory yet — it is
 *  a score. It becomes a memory the same way everything else in this app
 *  does: somebody chooses to put it down, and it only reaches the shelf
 *  once the other person writes their own perspective on it and keeps it
 *  together. The game gets no shortcut past the rule the whole app is
 *  about.
 *
 *  Only a player can place it, and only once. A watcher saw the game but
 *  did not play it, and a second copy of the same score is not a second
 *  memory. */
export function placeGame(
  houseSlug: string,
  person: string,
): number | PlaceGameRefusal {
  const house = houseBySlug(houseSlug);
  if (!house) return "no-game";
  const row = liveGameRow(house.id) ?? lastEndedGame(house.id);
  if (!row) return "no-game";
  if (row.bottom !== person && row.top !== person) return "not-playing";
  // 'stopped' is the point of this check: a game ended early has no score,
  // so there is nothing true to write down about it.
  if (row.ended !== "finished") return "game-not-finished";
  if (placedGameIds().has(row.id)) return "already-placed";

  const view = viewOf(row, person);
  const final = view.final ?? { bottom: 0, top: 0 };
  const names = { bottom: view.bottomName, top: view.topName ?? "nobody" };
  const title = `Ô ăn quan · ${names.bottom} and ${names.top}`;
  const body =
    view.winner === "draw"
      ? `A draw, ${final.bottom} each, over ${view.moveCount} ${view.moveCount === 1 ? "move" : "moves"}.`
      : `${view.winner === "bottom" ? names.bottom : names.top} won — ${names.bottom} ${final.bottom}, ${names.top} ${final.top}, over ${view.moveCount} ${view.moveCount === 1 ? "move" : "moves"}.`;

  const info = db
    .prepare(
      "INSERT INTO things (house_id, placed_by, title, body, game_id) VALUES (?, ?, ?, ?, ?)",
    )
    .run(house.id, person, title, body, row.id);
  return Number(info.lastInsertRowid);
}

/** The games already written down, so the interface can stop offering to
 *  write one down twice. Derived from the things rows themselves rather
 *  than from a flag on the game, for the same reason the shelf is: there
 *  is a fact underneath (a things row with this game_id) and a second copy
 *  of it could drift. */
const placedGameIds = (): Set<number> =>
  new Set(
    (
      db.prepare("SELECT game_id FROM things WHERE game_id IS NOT NULL").all() as Array<{
        game_id: number;
      }>
    ).map((r) => r.game_id),
  );

/** Whether this game has already been put down in the room. */
export const gameIsPlaced = (gameId: number): boolean => placedGameIds().has(gameId);

/** Every move of a game, oldest first — for the replay check that keeps the
 *  stored board honest. */
export function movesOf(gameId: number): Array<{
  seq: number;
  side: Side;
  kind: "sow" | "refill";
  pit: number | null;
  direction: Direction | null;
  boardAfter: string;
  bottomAfter: number;
  topAfter: number;
}> {
  return (
    db
      .prepare(
        `SELECT seq, side, kind, pit, direction, board_after, bottom_after, top_after
           FROM moves WHERE game_id = ? ORDER BY seq`,
      )
      .all(gameId) as Array<{
      seq: number;
      side: Side;
      kind: "sow" | "refill";
      pit: number | null;
      direction: Direction | null;
      board_after: string;
      bottom_after: number;
      top_after: number;
    }>
  ).map((r) => ({
    seq: r.seq,
    side: r.side,
    kind: r.kind,
    pit: r.pit,
    direction: r.direction,
    boardAfter: r.board_after,
    bottomAfter: r.bottom_after,
    topAfter: r.top_after,
  }));
}
