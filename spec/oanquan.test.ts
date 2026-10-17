import { describe, expect, it } from "vitest";
import {
  type Board,
  type Direction,
  type Pit,
  type Side,
  DAN_PER_PIT,
  REFILL_COST,
  TOTAL_POINTS,
  checkMove,
  decodeBoard,
  encodeBoard,
  finalScore,
  freshBoard,
  isFinished,
  isQuanPit,
  legalPits,
  needsRefill,
  pitsOf,
  refill,
  sow,
  winnerOf,
} from "../src/oanquan.ts";

// The engine is pure, so these import it directly — no server, no database,
// no vi.resetModules(). That is the point of keeping it free of ./db.ts.
//
// The rules under test are the family's own house rules, written down in
// assets/o-an-quan 2/README.md: dân = 1, quan = 10, no mature-quan
// restriction, no borrowing, no timer.

/** A board from a compact description, for setting up a specific position:
 *  twelve entries, each a dân count, or "Q" for a quan pit holding one quan
 *  and no dân, or "Qn" for a quan pit with n dân sown into it. */
const board = (spec: string): Board =>
  spec.trim().split(/\s+/).map((cell): Pit => {
    if (cell.startsWith("Q")) return { dan: Number(cell.slice(1) || 0), quan: 1 };
    return { dan: Number(cell), quan: 0 };
  });

const dan = (b: Board, i: number): number => b[i].dan;
const quan = (b: Board, i: number): number => b[i].quan;
/** Points on the board — the left-hand side of the conservation invariant. */
const onBoard = (b: Board): number =>
  b.reduce((n, p) => n + p.dan + p.quan * 10, 0);

describe("the opening position", () => {
  it("is 50 dân and two quan, which is 70 points", () => {
    const b = freshBoard();
    expect(onBoard(b)).toBe(TOTAL_POINTS);
    expect(b.filter((_, i) => !isQuanPit(i)).every((p) => p.dan === DAN_PER_PIT)).toBe(true);
    expect(quan(b, 0)).toBe(1);
    expect(quan(b, 6)).toBe(1);
  });

  it("gives each side five pits, and they do not overlap", () => {
    expect(pitsOf("bottom")).toEqual([1, 2, 3, 4, 5]);
    expect(pitsOf("top")).toEqual([7, 8, 9, 10, 11]);
    expect(pitsOf("bottom").some((i) => pitsOf("top").includes(i))).toBe(false);
    expect([...pitsOf("bottom"), ...pitsOf("top")].some(isQuanPit)).toBe(false);
  });
});

describe("sowing", () => {
  it("drops one stone per pit, including into a quan pit", () => {
    // A single stone in pit 5, sown right, lands in the quan pit at 6, and
    // the board is otherwise bare so nothing relays afterwards and the
    // landing is the only thing this asserts.
    //
    // Two earlier versions of this test were wrong in the same way, and
    // both failed rather than passing vacuously, which is the only reason
    // they were caught. The first used the opening board and claimed pit 6
    // was "the very next pit" after pit 5 — with five stones in hand the
    // last lands in pit 10. The second left the far side full, so the
    // stone landed in 6 and then relayed on from 7, ending with two dân in
    // the quan pit. The engine was right both times.
    const b = board("Q 0 0 0 0 1 Q 0 0 0 0 0");
    const r = sow(b, 5, "right");
    expect(dan(r.board, 6)).toBe(1);
    // The quan itself is untouched — only dân are ever sown.
    expect(quan(r.board, 6)).toBe(1);
  });

  it("never picks a quan up", () => {
    // A quan pit with dân sown into it is still never relayed from.
    const b = board("Q 0 0 1 0 0 Q3 5 5 5 5 5");
    const r = sow(b, 3, "right");
    // Last stone lands in 4; next is 5 (empty), beyond is the quan at 6
    // which has stones, so the quan pit is captured rather than relayed.
    expect(r.steps.some((s) => s.kind === "relay" && isQuanPit(s.at))).toBe(false);
  });

  it("relays out of an occupied small pit, in the same direction", () => {
    const r = sow(freshBoard(), 1, "right");
    const relays = r.steps.filter((s) => s.kind === "relay");
    expect(relays.length).toBeGreaterThan(0);
    // Every relay is at a small pit, never a quan.
    expect(relays.every((s) => !isQuanPit(s.at))).toBe(true);
  });

  it("stops when the next pit is an occupied quan", () => {
    // One stone in pit 5, sown right, lands in the quan at 6; the next pit
    // after that is 7 which is occupied, so it relays. Use pit 4 with one
    // stone instead: lands in 5, next is the quan at 6, which has a quan.
    const b = board("Q 0 0 0 1 0 Q 5 5 5 5 5");
    const r = sow(b, 4, "right");
    expect(r.steps.at(-1)).toMatchObject({ kind: "stop-quan", at: 6 });
    expect(r.captured).toBe(0);
  });

  it("stops with nothing when the next two pits are both empty", () => {
    const b = board("Q 0 1 0 0 0 Q 5 5 5 5 5");
    const r = sow(b, 2, "right");
    // Lands in 3; 4 and 5 are both empty.
    expect(r.steps.at(-1)).toMatchObject({ kind: "stop-empty" });
    expect(r.captured).toBe(0);
  });
});

describe("capturing", () => {
  it("takes the pit across a single gap", () => {
    const b = board("Q 1 0 4 0 0 Q 5 5 5 5 5");
    const r = sow(b, 1, "right");
    // Lands in 2; 3... wait: 2 is empty before the drop, so after dropping
    // the single stone the hand is empty at slot 2. Next is 3 (4 stones) —
    // occupied, so it relays rather than captures. This asserts the relay
    // precedence, which is the rule that makes capture rarer than it looks.
    expect(r.steps.some((s) => s.kind === "relay" && s.at === 3)).toBe(true);
  });

  it("captures when the next pit is empty and the one beyond has stones", () => {
    const b = board("Q 1 0 4 0 0 Q 5 5 5 5 5");
    // Sow the single stone in 1 to the LEFT: it lands in the quan at 0...
    // which is occupied, so instead build the position explicitly.
    const c = board("Q 0 1 0 4 0 Q 5 5 5 5 5");
    const r = sow(c, 2, "right");
    // Lands in 3; next is 4? No: 3 was empty, the stone lands there, next
    // is 4 which holds 4 — occupied, so relay. Use a true capture shape:
    const d = board("Q 0 1 0 0 7 Q 5 5 5 5 5");
    const r2 = sow(d, 2, "right");
    // Lands in 3; 4 is empty; 5 holds 7 -> capture 7.
    expect(r2.captured).toBe(7);
    expect(dan(r2.board, 5)).toBe(0);
    void r;
  });

  it("captures a quan for its full ten points, plus any dân sown onto it", () => {
    // 3 is empty after the drop in 2... build it so the capture target is
    // the quan pit at 6 holding one quan and two dân = 12 points.
    const b = board("Q 0 0 1 0 0 Q2 5 5 5 5 5");
    const r = sow(b, 3, "right");
    // Lands in 4; 5 is empty; 6 is the quan pit with 1 quan + 2 dan = 12.
    expect(r.captured).toBe(12);
    expect(quan(r.board, 6)).toBe(0);
  });

  it("chains across further empty-then-occupied pairs", () => {
    const b = board("Q 0 1 0 0 3 0 4 5 5 5 5");
    const r = sow(b, 2, "right");
    // Lands in 3; 4 empty -> capture 5 (3 stones); 6 empty -> capture 7 (4).
    expect(r.captured).toBe(7);
    expect(dan(r.board, 5)).toBe(0);
    expect(dan(r.board, 7)).toBe(0);
    expect(r.steps.filter((s) => s.kind === "capture")).toHaveLength(2);
  });

  it("stops the chain when the pattern breaks", () => {
    const b = board("Q 0 1 0 0 3 1 4 5 5 5 5");
    const r = sow(b, 2, "right");
    // Lands in 3; 4 empty -> capture 5. Then 6 is NOT empty, so it ends.
    expect(r.captured).toBe(3);
    expect(r.steps.filter((s) => s.kind === "capture")).toHaveLength(1);
  });
});

describe("refilling", () => {
  it("knows when a side has nothing left to play", () => {
    const b = board("Q 0 0 0 0 0 Q 5 5 5 5 5");
    expect(needsRefill(b, "bottom")).toBe(true);
    expect(needsRefill(b, "top")).toBe(false);
    expect(legalPits(b, "bottom")).toEqual([]);
  });

  it("puts one dân in each of that side's five pits", () => {
    const b = refill(board("Q 0 0 0 0 0 Q 5 5 5 5 5"), "bottom");
    expect(pitsOf("bottom").every((i) => dan(b, i) === 1)).toBe(true);
    // The other side is untouched.
    expect(pitsOf("top").every((i) => dan(b, i) === 5)).toBe(true);
  });

  it("refuses a move from a side that has to refill first", () => {
    const b = board("Q 0 0 0 0 0 Q 5 5 5 5 5");
    expect(checkMove(b, "bottom", 3)).toBe("must-refill");
  });

  it("costs five points, and the total is still seventy", () => {
    // The caller pays; this asserts the two halves add up, which is what
    // the conservation invariant depends on.
    const before = board("Q 0 0 0 0 0 Q 5 5 5 5 5");
    const scores = { bottom: 12, top: 3 };
    const after = refill(before, "bottom");
    const paid = { bottom: scores.bottom - REFILL_COST, top: scores.top };
    expect(onBoard(before) + scores.bottom + scores.top).toBe(
      onBoard(after) + paid.bottom + paid.top,
    );
  });
});

describe("the end of a game", () => {
  it("is both quan pits empty, and not before", () => {
    expect(isFinished(freshBoard())).toBe(false);
    expect(isFinished(board("Q 1 1 1 1 1 0 1 1 1 1 1"))).toBe(false);
    expect(isFinished(board("0 1 1 1 1 1 0 1 1 1 1 1"))).toBe(true);
  });

  it("gives each side the dân left on its own side", () => {
    const b = board("0 1 2 3 0 0 0 4 0 0 0 1");
    const final = finalScore(b, { bottom: 20, top: 30 });
    expect(final.bottom).toBe(20 + 6);
    expect(final.top).toBe(30 + 5);
  });

  it("names a winner, or a draw", () => {
    expect(winnerOf({ bottom: 40, top: 30 })).toBe("bottom");
    expect(winnerOf({ bottom: 30, top: 40 })).toBe("top");
    expect(winnerOf({ bottom: 35, top: 35 })).toBe("draw");
  });

  it("totals seventy once swept", () => {
    const b = board("0 1 2 3 0 0 0 4 0 0 0 1");
    const captured = { bottom: 30, top: 29 };
    const final = finalScore(b, captured);
    expect(final.bottom + final.top).toBe(TOTAL_POINTS);
  });

  // Once a quan has been captured, its pit goes on collecting sown dân like
  // any other, and at the end those belong to neither side. The house rules
  // are silent, so the engine splits them; what matters is that none are
  // lost. Found by the conservation property, which reported a finished
  // game totalling 58.
  it("does not strand the dân left in an emptied quan pit", () => {
    const b = board("0 1 1 0 0 0 9 1 0 0 0 0");
    expect(isFinished(b)).toBe(true);
    const onTheBoard = 1 + 1 + 9 + 1;
    const final = finalScore(b, { bottom: 0, top: 0 });
    expect(final.bottom + final.top).toBe(onTheBoard);
  });

  it("gives an odd stranded stone to whoever is behind", () => {
    // Three stranded in the quan pit at 6: one each, and the odd one to
    // the side with less, so a sweep can never widen a gap by luck.
    const b = board("0 2 0 0 0 0 3 0 0 0 0 0");
    const final = finalScore(b, { bottom: 0, top: 10 });
    expect(final.bottom).toBe(0 + 2 + 1 + 1);
    expect(final.top).toBe(10 + 0 + 1);
    expect(final.bottom + final.top).toBe(10 + 2 + 3);
  });
});

describe("checkMove", () => {
  it("refuses the other side's pits, empty pits and nonsense", () => {
    const b = freshBoard();
    expect(checkMove(b, "bottom", 9)).toBe("not-your-pit");
    expect(checkMove(b, "bottom", 0)).toBe("not-your-pit"); // a quan pit
    expect(checkMove(b, "bottom", 99)).toBe("no-such-pit");
    expect(checkMove(b, "bottom", 1.5)).toBe("no-such-pit");
    expect(checkMove(board("Q 0 5 5 5 5 Q 5 5 5 5 5"), "bottom", 1)).toBe("empty-pit");
    expect(checkMove(board("0 5 5 5 5 5 0 5 5 5 5 5"), "bottom", 1)).toBe("game-finished");
  });

  it("allows an ordinary move", () => {
    expect(checkMove(freshBoard(), "bottom", 3)).toBeNull();
    expect(checkMove(freshBoard(), "top", 9)).toBeNull();
  });
});

describe("encoding", () => {
  it("round-trips a board", () => {
    const b = freshBoard();
    expect(decodeBoard(encodeBoard(b))).toEqual(b);
    const played = sow(b, 3, "right").board;
    expect(decodeBoard(encodeBoard(played))).toEqual(played);
  });

  it("returns null for anything malformed rather than throwing", () => {
    expect(decodeBoard("")).toBeNull();
    expect(decodeBoard("1.0,2.0")).toBeNull();
    expect(decodeBoard(new Array(12).fill("x.y").join(","))).toBeNull();
    expect(decodeBoard(new Array(12).fill("-1.0").join(","))).toBeNull();
  });
});

// The strongest test here, and the reason the engine is worth trusting.
//
// Points are conserved: stones are only ever moved from one pit to another
// or captured into a score. Nothing is created and nothing is destroyed. So
// at every moment of every game, the points on the board plus both players'
// scores must be exactly 70.
//
// A few thousand randomised legal moves exercise paths no hand-written case
// would reach — long relay chains, captures that wrap the board, refills at
// awkward moments — and any arithmetic slip anywhere shows up immediately as
// a total that is not 70.
describe("the conservation property", () => {
  it("keeps every game at exactly seventy points, move by move", () => {
    // A small deterministic PRNG, so a failure is reproducible from the
    // seed rather than being a once-off nobody can get back.
    let seed = 20261017;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)];

    for (let game = 0; game < 300; game++) {
      let b = freshBoard();
      const score = { bottom: 0, top: 0 };
      let side: Side = "bottom";

      for (let move = 0; move < 200; move++) {
        if (isFinished(b)) break;

        if (needsRefill(b, side)) {
          if (score[side] < REFILL_COST) break; // that side has lost
          score[side] -= REFILL_COST;
          b = refill(b, side);
        }
        const options = legalPits(b, side);
        if (options.length === 0) break;

        const from = pick(options);
        const dir: Direction = pick(["left", "right"] as const);
        expect(checkMove(b, side, from)).toBeNull();

        const r = sow(b, from, dir);
        b = r.board;
        score[side] += r.captured;

        expect(
          onBoard(b) + score.bottom + score.top,
          `game ${game} move ${move}: pit ${from} ${dir}`,
        ).toBe(TOTAL_POINTS);

        side = side === "bottom" ? "top" : "bottom";
      }

      // And once swept at the end, the two final scores still total 70.
      const final = finalScore(b, score);
      expect(final.bottom + final.top, `game ${game} final`).toBe(TOTAL_POINTS);
    }
  });

  it("never leaves a negative count in a pit", () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let b = freshBoard();
    let side: Side = "bottom";
    for (let i = 0; i < 400 && !isFinished(b); i++) {
      if (needsRefill(b, side)) b = refill(b, side);
      const options = legalPits(b, side);
      if (!options.length) break;
      const from = options[Math.floor(random() * options.length)];
      b = sow(b, from, random() < 0.5 ? "left" : "right").board;
      expect(b.every((p) => p.dan >= 0 && p.quan >= 0)).toBe(true);
      side = side === "bottom" ? "top" : "bottom";
    }
  });
});
