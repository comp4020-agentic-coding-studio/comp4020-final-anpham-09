import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The game, tested against a throwaway database rather than over HTTP. All
// four house slugs are already claimed at the HTTP layer (routes.test.ts owns
// canberra and hanoi, realtime.test.ts owns meeting and nghe-an), so a game
// test that needed its own live table would have to fight one of them for it.
// A private database is the right shape anyway: none of what follows is about
// HTTP.

type Games = typeof import("../src/games.ts");
type Things = typeof import("../src/things.ts");
type Oanquan = typeof import("../src/oanquan.ts");
type Db = typeof import("../src/db.ts");

let dbPath: string;

async function boot(): Promise<{ games: Games; engine: Oanquan; things: Things; db: Db["db"] }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  const people = await import("../src/people.ts");
  people.ensurePerson("an", "An", "nghe-an");
  people.ensurePerson("linh", "Linh", "hanoi");
  people.ensurePerson("mai", "Mai", "canberra");
  return {
    games: (await import("../src/games.ts")) as Games,
    engine: (await import("../src/oanquan.ts")) as Oanquan,
    things: (await import("../src/things.ts")) as Things,
    db: ((await import("../src/db.ts")) as Db).db,
  };
}

/** Play until the board finishes on its own, the way a real game ends.
 *  Deterministic: the same seed every run, so a failure is reproducible.
 *  Returns null if this particular walk got stuck instead of finishing —
 *  the caller decides whether that is the case it wanted. */
async function playToTheEnd(
  games: Games,
  engine: Oanquan,
  seedStart: number,
): Promise<"finished" | "stuck" | "gave-up"> {
  let seed = seedStart;
  const next = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let turn = 0; turn < 400; turn += 1) {
    const view = games.gameAt("meeting", "an");
    if (!view) return "gave-up";
    if (view.ended) return "finished";
    if (view.stuck) return "stuck";
    const mover = view.turn === "bottom" ? "an" : "linh";
    const pits = engine.legalPits(view.board, view.turn);
    if (pits.length === 0) return "gave-up";
    const refusal = games.play("meeting", mover, pits[next(pits.length)], next(2) === 0 ? "left" : "right");
    if (refusal) return "gave-up";
  }
  return "gave-up";
}

beforeEach(() => {
  dbPath = join(mkdtempSync(join(tmpdir(), "village-games-")), "app.db");
});

describe("sitting down at the table", () => {
  it("seats the first person at the bottom and the second at the top", async () => {
    const { games } = await boot();
    const id = games.sitDown("meeting", "an");
    expect(typeof id).toBe("number");
    expect(games.sitDown("meeting", "linh")).toBe(id);

    const view = games.gameAt("meeting", "an");
    expect(view?.bottomName).toBe("An");
    expect(view?.topName).toBe("Linh");
    expect(view?.yourSide).toBe("bottom");
    expect(view?.yourTurn).toBe(true);
  });

  it("refuses a third person, and refuses the same person twice", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    expect(games.sitDown("meeting", "an")).toBe("already-seated");
    games.sitDown("meeting", "linh");
    expect(games.sitDown("meeting", "mai")).toBe("chairs-taken");
  });

  it("keeps the game out of the household houses", async () => {
    const { games } = await boot();
    expect(games.sitDown("canberra", "an")).toBe("not-the-meeting-house");
    expect(games.sitDown("nowhere", "an")).toBe("unknown-house");
  });

  it("shows a watcher the board without a side", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    const view = games.gameAt("meeting", "mai");
    expect(view?.yourSide).toBe(null);
    expect(view?.yourTurn).toBe(false);
    expect(view?.playable).toEqual([]);
  });

  it("waits for a second player before anyone can move", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    const alone = games.gameAt("meeting", "an");
    expect(alone?.top).toBe(null);
    expect(alone?.yourTurn).toBe(false);
    expect(games.play("meeting", "an", 1, "right")).toBe("no-game");
  });
});

describe("the rules the schema enforces", () => {
  it("allows only one live game per house", async () => {
    const { games, db } = await boot();
    games.sitDown("meeting", "an");
    const houseId = (db.prepare("SELECT id FROM houses WHERE slug = 'meeting'").get() as {
      id: number;
    }).id;
    expect(() =>
      db.prepare("INSERT INTO games (house_id, bottom) VALUES (?, ?)").run(houseId, "mai"),
    ).toThrow(/UNIQUE/i);
  });

  it("refuses to seat one person on both sides", async () => {
    const { games, db } = await boot();
    const id = games.sitDown("meeting", "an") as number;
    expect(() => db.prepare("UPDATE games SET top = 'an' WHERE id = ?").run(id)).toThrow(
      /CHECK/i,
    );
  });

  it("will not let a played move be changed or taken back", async () => {
    const { games, db } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(games.play("meeting", "an", 1, "right")).toBe(null);

    expect(() => db.prepare("UPDATE moves SET pit = 2 WHERE seq = 1").run()).toThrow(
      /cannot be changed/,
    );
    expect(() => db.prepare("DELETE FROM moves WHERE seq = 1").run()).toThrow(
      /cannot be taken back/,
    );
  });
});

describe("taking a turn", () => {
  it("refuses a move that isn't yours to make", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(games.play("meeting", "linh", 7, "right")).toBe("not-your-turn");
    expect(games.play("meeting", "mai", 1, "right")).toBe("not-playing");
    expect(games.play("meeting", "an", 7, "right")).toBe("not-your-pit");
    expect(games.play("meeting", "an", 99, "right")).toBe("no-such-pit");
    expect(games.play("meeting", "an", 0, "right")).toBe("not-your-pit");
  });

  it("passes the turn to the other side", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    games.play("meeting", "an", 1, "right");

    const view = games.gameAt("meeting", "linh");
    expect(view?.turn).toBe("top");
    expect(view?.yourTurn).toBe(true);
    expect(view?.moveCount).toBe(1);
    expect(games.gameAt("meeting", "an")?.yourTurn).toBe(false);
  });

  it("offers only the pits on your side that have stones in them", async () => {
    const { games, engine } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    const view = games.gameAt("meeting", "an");
    expect(view?.playable).toEqual(engine.pitsOf("bottom"));
  });
});

describe("the board is only ever the moves", () => {
  // CLAUDE.md says derived state is never stored, and `moves.board_after`
  // is a deliberate, argued exception: it has one writer and no UPDATE
  // path. This is the test that makes the argument checkable rather than a
  // habit. Replay every move through the pure engine — which knows nothing
  // about the database — and the result must reproduce every stored board
  // and every stored score, exactly.
  //
  // If someone ever introduces a second writer, or lets the engine and the
  // persistence layer disagree about what a move does, this fails with the
  // seq of the first move that drifted.
  it("replays through the pure engine to exactly the boards it stored", async () => {
    const { games, engine } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    const gameId = games.gameAt("meeting", "an")!.id;

    // A deterministic walk rather than a random one: the same twenty-odd
    // moves every run, so a failure is reproducible from the seed alone.
    let seed = 20261017;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };

    for (let turn = 0; turn < 40; turn += 1) {
      const view = games.gameAt("meeting", "an");
      if (!view || view.ended) break;
      const mover = view.turn === "bottom" ? "an" : "linh";
      const pits = view.turn === view.yourSide ? view.playable : engine.legalPits(view.board, view.turn);
      if (pits.length === 0) break;
      const pit = pits[next(pits.length)];
      const refusal = games.play("meeting", mover, pit, next(2) === 0 ? "left" : "right");
      if (refusal) break;
    }

    const moves = games.movesOf(gameId);
    expect(moves.length).toBeGreaterThan(8);

    let board = engine.freshBoard();
    const scores = { bottom: 0, top: 0 };
    for (const move of moves) {
      if (move.kind === "refill") {
        scores[move.side] -= engine.REFILL_COST;
        board = engine.refill(board, move.side);
      } else {
        const result = engine.sow(board, move.pit!, move.direction!);
        board = result.board;
        scores[move.side] += result.captured;
      }
      expect({ seq: move.seq, board: engine.encodeBoard(board) }).toEqual({
        seq: move.seq,
        board: move.boardAfter,
      });
      expect({ seq: move.seq, ...scores }).toEqual({
        seq: move.seq,
        bottom: move.bottomAfter,
        top: move.topAfter,
      });
    }
  });

  it("conserves all seventy points across every stored move", async () => {
    const { games, engine } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    const gameId = games.gameAt("meeting", "an")!.id;

    for (let turn = 0; turn < 20; turn += 1) {
      const view = games.gameAt("meeting", "an");
      if (!view || view.ended) break;
      const mover = view.turn === "bottom" ? "an" : "linh";
      const pits = engine.legalPits(view.board, view.turn);
      if (pits.length === 0) break;
      if (games.play("meeting", mover, pits[0], "right")) break;
    }

    for (const move of games.movesOf(gameId)) {
      const board = engine.decodeBoard(move.boardAfter)!;
      expect({ seq: move.seq, total: engine.valueOf(board) + move.bottomAfter + move.topAfter }).toEqual(
        { seq: move.seq, total: engine.TOTAL_POINTS },
      );
    }
  });
});

/** Search, with the pure engine alone, for a game that ends in the
 *  cannot-afford-to-refill state, and return the moves that get there.
 *  Null if no seed in the search space reaches it.
 *
 *  This is pure and has no database, so four hundred games cost
 *  milliseconds. The alternative — driving games.ts and throwing away a
 *  SQLite file per attempt — is slow enough to discourage searching at
 *  all, and that is how this ending gets left untested. */
function movesThatGetStuck(
  engine: Oanquan,
): Array<["bottom" | "top", number, "left" | "right"]> | null {
  for (let s = 1; s <= 400; s += 1) {
    let seed = s * 7919;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    let board = engine.freshBoard();
    const scores = { bottom: 0, top: 0 };
    let turn: "bottom" | "top" = "bottom";
    const played: Array<["bottom" | "top", number, "left" | "right"]> = [];
    for (let n = 0; n < 400; n += 1) {
      if (engine.isFinished(board)) break;
      if (engine.needsRefill(board, turn)) {
        if (scores[turn] < engine.REFILL_COST) return played;
        scores[turn] -= engine.REFILL_COST;
        board = engine.refill(board, turn);
      }
      const pits = engine.legalPits(board, turn);
      if (pits.length === 0) break;
      const pit = pits[next(pits.length)];
      const dir = next(2) === 0 ? "left" : "right";
      const result = engine.sow(board, pit, dir);
      board = result.board;
      scores[turn] += result.captured;
      played.push([turn, pit, dir]);
      turn = turn === "bottom" ? "top" : "bottom";
    }
  }
  return null;
}

describe("the three ways a game ends", () => {
  it("ends early with no score, no winner, and nothing to keep", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    games.play("meeting", "an", 1, "right");

    // Either player can end it — here the one who did not start it.
    expect(games.endGame("meeting", "linh")).toBe(null);

    const view = games.gameAt("meeting", "an");
    expect(view?.ended).toBe("stopped");
    expect(view?.final).toBe(null);
    expect(view?.winner).toBe(null);
    // The whole point of the asymmetry: there is no result, so there is
    // nothing to put in the room.
    expect(view?.canPlace).toBe(false);
    expect(games.placeGame("meeting", "an")).toBe("game-not-finished");
  });

  it("refuses to let a watcher end somebody else's game", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    games.play("meeting", "an", 1, "right");
    expect(games.endGame("meeting", "mai")).toBe("not-playing");
    expect(games.gameAt("meeting", "an")?.ended).toBe(null);
  });

  it("finishes on its own when both quan are gone, and that one can be kept", async () => {
    const { games, engine } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(await playToTheEnd(games, engine, 20261017)).toBe("finished");

    const view = games.gameAt("meeting", "an");
    expect(view?.ended).toBe("finished");
    expect(view?.final).not.toBe(null);
    expect(view?.canPlace).toBe(true);
    // Points are conserved right through the ending: the final score is
    // the whole seventy, because every stone has been swept up by then.
    expect(view!.final!.bottom + view!.final!.top).toBe(engine.TOTAL_POINTS);
  });

  it("lets a side that cannot afford to refill be called as a loss", async () => {
    // The third ending, and the one that is easy to leave out. Without it
    // `play` refuses the move forever and the board is simply stuck: no
    // legal action for anybody and no way to finish. It happens in roughly
    // one game in fifty, which is often enough to matter and rare enough
    // never to meet by hand.
    //
    // The position is found by searching with the PURE engine — no
    // database, so it costs nothing — and the winning move list is then
    // replayed through games.ts. Searching with the real thing would mean
    // a fresh database per attempt; forging the position with an INSERT
    // would mean testing the forgery rather than the game.
    const { games, engine } = await boot();
    const moves = movesThatGetStuck(engine);
    expect(moves, "no seed in 400 reached the cannot-refill ending").not.toBe(null);

    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    for (const [side, pit, dir] of moves!) {
      expect(games.play("meeting", side === "bottom" ? "an" : "linh", pit, dir)).toBe(null);
    }

    const before = games.gameAt("meeting", "an")!;
    expect(before.stuck).not.toBe(null);
    expect(before.mustRefill).toBe(true);
    expect(before.canAffordRefill).toBe(false);
    expect(before.ended).toBe(null);
    // Stuck means stuck: the engine will not accept a move either, which
    // is correct of it and is exactly why something else has to end this.
    expect(games.play("meeting", before.turn === "bottom" ? "an" : "linh", 1, "right")).not.toBe(
      null,
    );

    expect(games.concede("meeting", "an")).toBe(null);
    const after = games.gameAt("meeting", "an")!;
    // It ends WITH a score, unlike ending early: the position was real and
    // the points on it were genuinely won. Only the next move was
    // impossible.
    expect(after.ended).toBe("finished");
    expect(after.final).not.toBe(null);
    expect(after.canPlace).toBe(true);
    expect(after.final!.bottom + after.final!.top).toBe(engine.TOTAL_POINTS);
    // And the side that was stuck is not the side that won.
    expect(after.winner).not.toBe(before.stuck);
  });

  it("will not let anyone concede a game that is still playable", async () => {
    const { games } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    games.play("meeting", "an", 1, "right");
    expect(games.concede("meeting", "an")).toBe("not-stuck");
    expect(games.concede("meeting", "linh")).toBe("not-stuck");
    expect(games.gameAt("meeting", "an")?.ended).toBe(null);
  });
});

describe("putting a finished game in the room", () => {
  it("goes in as a thing like any other, and reaches no shelf on its own", async () => {
    const { games, engine, things } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(await playToTheEnd(games, engine, 20261017)).toBe("finished");

    const id = games.placeGame("meeting", "an");
    expect(typeof id).toBe("number");

    const [thing] = things.inRoom("meeting", "an");
    expect(thing.title).toContain("Ô ăn quan");
    expect(thing.placedByName).toBe("An");
    // The game gets no shortcut past the rule the whole app is about.
    expect(thing.onShelf).toBe(false);
    expect(thing.keeperNames).toEqual([]);

    // And it reaches the shelf exactly the way everything else does.
    things.addPerspective(thing.id, "linh", "I should have seen that coming.");
    expect(things.keepTogether(thing.id, "linh")).toBe(null);
    expect(things.onShelf("meeting", "an")).toHaveLength(1);
  });

  it("is placed once, by a player, and never by a watcher", async () => {
    const { games, engine } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(await playToTheEnd(games, engine, 20261017)).toBe("finished");

    expect(games.placeGame("meeting", "mai")).toBe("not-playing");
    expect(typeof games.placeGame("meeting", "an")).toBe("number");
    // One game is one memory, however many times it is clicked — and the
    // other player cannot place a second copy of the same score either.
    expect(games.placeGame("meeting", "an")).toBe("already-placed");
    expect(games.placeGame("meeting", "linh")).toBe("already-placed");

    // And the offer is withdrawn rather than left on screen to be
    // refused. A button that cannot work teaches people the app is
    // broken; this is the same reasoning that keeps it off a game ended
    // early.
    expect(games.gameAt("meeting", "an")?.canPlace).toBe(false);
    expect(games.gameAt("meeting", "linh")?.canPlace).toBe(false);
  });

  it("writes down what actually happened, not a template", async () => {
    const { games, engine, things } = await boot();
    games.sitDown("meeting", "an");
    games.sitDown("meeting", "linh");
    expect(await playToTheEnd(games, engine, 20261017)).toBe("finished");

    const view = games.gameAt("meeting", "an")!;
    games.placeGame("meeting", "an");
    const [thing] = things.inRoom("meeting", "an");

    // Both names, both scores, and the real move count — so the card is
    // worth coming back to rather than being the same sentence every time.
    expect(thing.body).toContain(String(view.final!.bottom));
    expect(thing.body).toContain(String(view.final!.top));
    expect(thing.body).toContain(String(view.moveCount));
    expect(thing.title).toContain("An");
    expect(thing.title).toContain("Linh");
  });
});
