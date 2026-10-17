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
type Oanquan = typeof import("../src/oanquan.ts");
type Db = typeof import("../src/db.ts");

let dbPath: string;

async function boot(): Promise<{ games: Games; engine: Oanquan; db: Db["db"] }> {
  vi.resetModules();
  process.env.DATABASE_PATH = dbPath;
  const people = await import("../src/people.ts");
  people.ensurePerson("an", "An", "nghe-an");
  people.ensurePerson("linh", "Linh", "hanoi");
  people.ensurePerson("mai", "Mai", "canberra");
  return {
    games: (await import("../src/games.ts")) as Games,
    engine: (await import("../src/oanquan.ts")) as Oanquan,
    db: ((await import("../src/db.ts")) as Db).db,
  };
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
