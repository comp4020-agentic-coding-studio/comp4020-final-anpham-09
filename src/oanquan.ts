/** Ô ăn quan — the rules, and nothing else.
 *
 *  No `./db.ts`, no `node:http`, no `./render.ts`. The same discipline that
 *  makes `src/events.ts` testable without starting a server: this module is
 *  a set of pure functions over a board value, so the rules can be proved
 *  before anything can see them.
 *
 *  It also says nothing in English. The engine returns what happened as
 *  data (`Step[]`); turning that into "Pit 3 selected · 5 stones in hand"
 *  is the interface's job, and every user-facing sentence in this app lives
 *  in `src/render.ts` or in `REFUSALS`.
 *
 *  THE HOUSE RULES, as the family plays it (assets/o-an-quan 2/README.md),
 *  checked against oanquan.online's "Cơ bản" ruleset:
 *
 *    - Ten small pits hold five dân each; the two end pits hold one quan
 *      each. Dân are worth 1, quan 10 — so a game is always 70 points.
 *    - You sow from a non-empty small pit on your own side, one stone per
 *      pit, left or right, around the whole board including the quan pits.
 *    - After the last stone lands: an occupied small pit next means pick it
 *      up and keep going the same way. An occupied quan pit next means stop
 *      — a quan is never picked up.
 *    - Empty next, occupied beyond it: capture that second pit. Repeat
 *      across further empty-then-occupied pairs. Then the turn ends.
 *    - Empty next and empty beyond: the turn ends with nothing captured.
 *    - If your five pits are empty when your turn starts, pay five captured
 *      points to put one dân in each. Fewer than five points and the game
 *      is lost.
 *    - When both quan pits are empty the game is over: each side takes the
 *      dân left on its own side. Higher total wins; equal is a draw.
 *
 *  No mature-quan (Quan Già) restriction, no borrowing, no timer.
 */

/** A pit holds dân and quan separately, and this is the whole reason the
 *  engine is correct.
 *
 *  Occupancy and value are different questions. Occupancy decides whether a
 *  pit stops a sow or can be captured; value decides the score. A first
 *  draft modelled a quan as "one stone" and capturing a quan pit then
 *  scored 2 points instead of 11 — the arithmetic was consistent and
 *  completely wrong. Keeping the two counts apart makes that class of bug
 *  unrepresentable. */
export interface Pit {
  dan: number;
  quan: number;
}

/** Twelve positions, clockwise. 0 and 6 are the quan pits; 1-5 belong to
 *  `bottom`, 7-11 to `top`. Readonly because every function here returns a
 *  new board rather than editing one in place. */
export type Board = readonly Pit[];
export type Direction = "left" | "right";
export type Side = "bottom" | "top";

export const SLOTS = 12;
export const QUAN_VALUE = 10;
export const DAN_PER_PIT = 5;
export const REFILL_COST = 5;
/** 50 dân + two quan at 10. Fixed for the whole game: stones only ever move
 *  or get captured, never appear or vanish. */
export const TOTAL_POINTS = 70;

const QUAN_SLOTS: ReadonlySet<number> = new Set([0, 6]);
const BOTTOM_PITS: readonly number[] = [1, 2, 3, 4, 5];
const TOP_PITS: readonly number[] = [7, 8, 9, 10, 11];

export const isQuanPit = (slot: number): boolean => QUAN_SLOTS.has(slot);

export const pitsOf = (side: Side): readonly number[] =>
  side === "bottom" ? BOTTOM_PITS : TOP_PITS;

export const otherSide = (side: Side): Side => (side === "bottom" ? "top" : "bottom");

/** Going "right" means increasing slot number, wrapping 11 to 0. */
const step = (slot: number, dir: Direction): number =>
  (slot + (dir === "right" ? 1 : SLOTS - 1)) % SLOTS;

/** How many stones are in a pit — what decides whether a sow stops there or
 *  whether it can be captured. Not the same question as `pointsIn`. */
const stonesIn = (p: Pit): number => p.dan + p.quan;

/** What a pit is worth. Not the same question as `stonesIn`. */
const pointsIn = (p: Pit): number => p.dan + p.quan * QUAN_VALUE;

export function freshBoard(): Board {
  return Array.from({ length: SLOTS }, (_, i) =>
    isQuanPit(i) ? { dan: 0, quan: 1 } : { dan: DAN_PER_PIT, quan: 0 },
  );
}

/** The points still on the board. With both scores this always sums to
 *  TOTAL_POINTS — the invariant the property test checks after every move. */
export function valueOf(board: Board): number {
  return board.reduce((n, p) => n + pointsIn(p), 0);
}

/** Both quan gone: the game is over. */
export function isFinished(board: Board): boolean {
  return board.filter((_, i) => isQuanPit(i)).every((p) => p.quan === 0);
}

/** A side's five pits are all empty, so its turn must start by refilling. */
export function needsRefill(board: Board, side: Side): boolean {
  return pitsOf(side).every((i) => stonesIn(board[i]) === 0);
}

/** The pits this side may pick up from right now. Empty when the side needs
 *  to refill first — which is a different situation from having no legal
 *  move, and the caller is expected to ask `needsRefill` about it. */
export function legalPits(board: Board, side: Side): number[] {
  return pitsOf(side).filter((i) => stonesIn(board[i]) > 0);
}

/** One observable thing that happened during a turn, in order. The engine
 *  produces facts; `src/render.ts` turns them into a sentence. */
export interface Step {
  kind: "pick" | "relay" | "capture" | "stop-quan" | "stop-empty";
  at: number;
  /** Stones picked up or relayed; points captured. Absent for the stops. */
  amount?: number;
}

export interface SowResult {
  board: Board;
  /** Points taken this turn. */
  captured: number;
  steps: Step[];
}

/** Why a move was refused, or null if it is legal. These are returned, never
 *  thrown, and every one has a sentence in `REFUSALS`. */
export type MoveRefusal =
  | "no-such-pit"
  | "not-your-pit"
  | "empty-pit"
  | "must-refill"
  | "game-finished";

export function checkMove(board: Board, side: Side, from: number): MoveRefusal | null {
  if (!Number.isInteger(from) || from < 0 || from >= SLOTS) return "no-such-pit";
  if (isFinished(board)) return "game-finished";
  if (!pitsOf(side).includes(from)) return "not-your-pit";
  if (needsRefill(board, side)) return "must-refill";
  if (stonesIn(board[from]) === 0) return "empty-pit";
  return null;
}

/** A whole turn: sow, relay as far as it goes, capture what the pattern
 *  allows, and stop. The caller is responsible for checking `checkMove`
 *  first and for deciding whose turn is next.
 *
 *  Only dân are ever sown. A quan sits in its pit until it is captured —
 *  `b[at].dan++` below is what encodes that, and it is why a pit needs two
 *  counts rather than one. */
export function sow(board: Board, from: number, dir: Direction): SowResult {
  const b: Pit[] = board.map((p) => ({ ...p }));
  const steps: Step[] = [];
  let captured = 0;

  let hand = b[from].dan;
  b[from].dan = 0;
  steps.push({ kind: "pick", at: from, amount: hand });

  let at = from;
  for (;;) {
    while (hand > 0) {
      at = step(at, dir);
      b[at].dan++;
      hand--;
    }
    const nextSlot = step(at, dir);
    const beyond = step(nextSlot, dir);

    // An occupied quan ends the turn. Checked before the relay, because a
    // quan pit is occupied too and must never be picked up.
    if (isQuanPit(nextSlot) && stonesIn(b[nextSlot]) > 0) {
      steps.push({ kind: "stop-quan", at: nextSlot });
      break;
    }
    // An occupied small pit: pick it up and carry on the same way.
    if (stonesIn(b[nextSlot]) > 0) {
      hand = b[nextSlot].dan;
      b[nextSlot].dan = 0;
      at = nextSlot;
      steps.push({ kind: "relay", at: nextSlot, amount: hand });
      continue;
    }
    // Empty next. Something beyond it is a capture; nothing is the end.
    if (stonesIn(b[beyond]) > 0) {
      let target = beyond;
      for (;;) {
        const taken = pointsIn(b[target]);
        captured += taken;
        b[target] = { dan: 0, quan: 0 };
        steps.push({ kind: "capture", at: target, amount: taken });
        const gap = step(target, dir);
        const next = step(gap, dir);
        if (stonesIn(b[gap]) === 0 && stonesIn(b[next]) > 0) {
          target = next;
          continue;
        }
        break;
      }
      break;
    }
    steps.push({ kind: "stop-empty", at: nextSlot });
    break;
  }

  return { board: b, captured, steps };
}

/** Bù dân: one dân into each of a side's five pits. The caller deducts
 *  REFILL_COST from that side's score — the engine does not hold scores,
 *  so it cannot do it here, and the conservation invariant depends on the
 *  caller doing both halves together. */
export function refill(board: Board, side: Side): Board {
  const b: Pit[] = board.map((p) => ({ ...p }));
  for (const i of pitsOf(side)) b[i].dan += 1;
  return b;
}

/** The end: each side takes the dân left on its own side and adds it to
 *  what it captured. Called when `isFinished` is true.
 *
 *  The two quan pits need sweeping too, and this is easy to miss. Once a
 *  quan has been captured its pit keeps taking sown dân like any other, so
 *  at the end there can be a pile sitting in a pit that belongs to neither
 *  side. Found by the conservation property test, which reported a finished
 *  game totalling 58 rather than 70: twelve points were on the board and
 *  only three were collected.
 *
 *  The house rules say nothing about this case, so the rule here is the one
 *  that loses nothing and favours nobody: a quan pit's leftovers are split,
 *  and an odd stone goes to the side that is otherwise behind — and to
 *  `bottom` when they are level, which only decides a stone in a drawn
 *  game. The alternative, dropping them, would make the final scores not
 *  add up to 70 and quietly contradict the board the family can see. */
export function finalScore(
  board: Board,
  scores: { bottom: number; top: number },
): { bottom: number; top: number } {
  const sweep = (side: Side): number =>
    pitsOf(side).reduce((n, i) => n + pointsIn(board[i]), 0);
  let bottom = scores.bottom + sweep("bottom");
  let top = scores.top + sweep("top");

  const stranded = board.reduce(
    (n, p, i) => (isQuanPit(i) ? n + pointsIn(p) : n),
    0,
  );
  const half = Math.floor(stranded / 2);
  bottom += half;
  top += half;
  if (stranded % 2 === 1) {
    if (bottom < top) bottom += 1;
    else if (top < bottom) top += 1;
    else bottom += 1;
  }
  return { bottom, top };
}

/** Who won, once the board is finished and swept. */
export function winnerOf(final: { bottom: number; top: number }): Side | "draw" {
  if (final.bottom > final.top) return "bottom";
  if (final.top > final.bottom) return "top";
  return "draw";
}

/** Board as a short string, for storing and for reading in a sqlite3 dump:
 *  twelve "dan.quan" pairs, comma separated. */
export function encodeBoard(board: Board): string {
  return board.map((p) => `${p.dan}.${p.quan}`).join(",");
}

/** The inverse. Returns null rather than throwing on anything malformed, so
 *  a corrupt row surfaces as a finding instead of a 500. */
export function decodeBoard(s: string): Board | null {
  const parts = s.split(",");
  if (parts.length !== SLOTS) return null;
  const board: Pit[] = [];
  for (const part of parts) {
    const [dan, quan] = part.split(".").map(Number);
    if (!Number.isInteger(dan) || !Number.isInteger(quan)) return null;
    if (dan < 0 || quan < 0) return null;
    board.push({ dan, quan });
  }
  return board;
}
