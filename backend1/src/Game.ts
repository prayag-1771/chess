import { WebSocket } from "ws";
import { Chess } from "chess.js";
import {
  GAME_OVER,
  INIT_GAME,
  MOVE,
  INVALID_MOVE,
  DRAW_OFFER,
  DRAW_DECLINE,
  OPPONENT_DISCONNECTED,
} from "./messages";
import { randomUUID } from "crypto";

export type GameResult = {
  winner: "white" | "black" | "draw";
  reason:
    | "checkmate"
    | "stalemate"
    | "insufficient_material"
    | "threefold_repetition"
    | "fifty_move_rule"
    | "draw_agreement"
    | "resignation"
    | "disconnect"
    | "timeout";
};

export class Game {
  public readonly id: string;
  public player1: WebSocket;
  public player2: WebSocket;
  public board: Chess;
  public startTime: Date;
  public isOver = false;
  private drawOfferedBy: WebSocket | null = null;
  public timeLeftMs: { white: number; black: number };
  private lastMoveTime: number;
  private incrementMs: number;
  private timer: ReturnType<typeof setInterval>;
  private hasStarted = false;

  constructor(player1: WebSocket, player2: WebSocket, timeControl: string) {
    this.id = randomUUID().slice(0, 8);
    this.player1 = player1;
    this.player2 = player2;
    this.board = new Chess();
    this.startTime = new Date();

    let minutes = 10;
    this.incrementMs = 0;
    if (timeControl === "3+2") { minutes = 3; this.incrementMs = 2000; }
    else if (timeControl === "5+0") { minutes = 5; }
    else if (timeControl === "10+0") { minutes = 10; }

    const startingTime = minutes * 60 * 1000;
    this.timeLeftMs = { white: startingTime, black: startingTime };
    this.lastMoveTime = Date.now();

    this.safeSend(this.player1, {
      type: INIT_GAME,
      payload: { color: "white", timeLeftMs: this.timeLeftMs },
    });
    this.safeSend(this.player2, {
      type: INIT_GAME,
      payload: { color: "black", timeLeftMs: this.timeLeftMs },
    });

    console.log(`[${this.id}] game created (${timeControl})`);

    this.timer = setInterval(() => this.checkTime(), 500);
  }

  private checkTime(): void {
    if (this.isOver || !this.hasStarted) return;
    const now = Date.now();
    const turn = this.board.turn() === "w" ? "white" : "black";
    const elapsed = now - this.lastMoveTime;
    
    if (this.timeLeftMs[turn] - elapsed <= 0) {
      this.timeLeftMs[turn] = 0;
      this.endGame({ winner: turn === "white" ? "black" : "white", reason: "timeout" });
    }
  }

  private safeSend(socket: WebSocket, data: object): boolean {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  private getOpponent(socket: WebSocket): WebSocket {
    return socket === this.player1 ? this.player2 : this.player1;
  }

  private getColor(socket: WebSocket): "white" | "black" {
    return socket === this.player1 ? "white" : "black";
  }

  private isPlayersTurn(socket: WebSocket): boolean {
    const turn = this.board.turn();
    if (turn === "w" && socket === this.player1) return true;
    if (turn === "b" && socket === this.player2) return true;
    return false;
  }

  private endGame(result: GameResult): void {
    if (this.isOver) return;
    this.isOver = true;
    clearInterval(this.timer);

    const payload = { type: GAME_OVER, payload: result };
    this.safeSend(this.player1, payload);
    this.safeSend(this.player2, payload);

    console.log(`[${this.id}] game over: ${result.winner} wins (${result.reason})`);
  }

  private checkGameState(): void {
    if (!this.board.isGameOver()) return;

    if (this.board.isCheckmate()) {
      this.endGame({
        winner: this.board.turn() === "w" ? "black" : "white",
        reason: "checkmate",
      });
    } else if (this.board.isStalemate()) {
      this.endGame({ winner: "draw", reason: "stalemate" });
    } else if (this.board.isInsufficientMaterial()) {
      this.endGame({ winner: "draw", reason: "insufficient_material" });
    } else if (this.board.isThreefoldRepetition()) {
      this.endGame({ winner: "draw", reason: "threefold_repetition" });
    } else if (this.board.isDraw()) {
      this.endGame({ winner: "draw", reason: "fifty_move_rule" });
    }
  }

  makeMove(
    socket: WebSocket,
    move: { from: string; to: string; promotion?: string }
  ): void {
    if (this.isOver) return;

    if (!this.isPlayersTurn(socket)) {
      this.safeSend(socket, {
        type: INVALID_MOVE,
        payload: { message: "Not your turn" },
      });
      return;
    }

    if (
      !move ||
      typeof move.from !== "string" ||
      typeof move.to !== "string"
    ) {
      this.safeSend(socket, {
        type: INVALID_MOVE,
        payload: { message: "Invalid move format: from and to are required" },
      });
      return;
    }

    try {
      const moveObj: { from: string; to: string; promotion?: string } = {
        from: move.from,
        to: move.to,
      };

      const piece = this.board.get(move.from as any);
      if (piece && piece.type === "p") {
        const toRank = move.to.charAt(1);
        if (toRank === "1" || toRank === "8") {
          moveObj.promotion = move.promotion || "q";
        }
      }

      const result = this.board.move(moveObj);

      if (!result) {
        this.safeSend(socket, {
          type: INVALID_MOVE,
          payload: { message: "Illegal move" },
        });
        return;
      }

      this.drawOfferedBy = null;

      console.log(`[${this.id}] ${this.getColor(socket)} plays ${result.from}-${result.to}${result.promotion ? "=" + result.promotion : ""}`);

      const now = Date.now();
      if (this.hasStarted) {
        const turn = this.board.turn() === "b" ? "white" : "black";
        const elapsed = now - this.lastMoveTime;
        this.timeLeftMs[turn] -= elapsed;
        this.timeLeftMs[turn] += this.incrementMs;
      } else {
        this.hasStarted = true;
      }
      this.lastMoveTime = now;

      const movePayload: { from: string; to: string; promotion?: string; timeLeftMs?: any } = {
        from: result.from,
        to: result.to,
        timeLeftMs: this.timeLeftMs,
      };
      if (result.promotion) {
        movePayload.promotion = result.promotion;
      }

      this.safeSend(this.getOpponent(socket), {
        type: MOVE,
        payload: movePayload,
      });

      this.checkGameState();
    } catch {
      this.safeSend(socket, {
        type: INVALID_MOVE,
        payload: { message: "Illegal move" },
      });
    }
  }

  handleResign(socket: WebSocket): void {
    if (this.isOver) return;

    const winner = socket === this.player1 ? "black" : "white";
    this.endGame({ winner, reason: "resignation" });
  }

  handleDrawOffer(socket: WebSocket): void {
    if (this.isOver) return;
    if (this.drawOfferedBy === socket) return;

    this.drawOfferedBy = socket;
    this.safeSend(this.getOpponent(socket), {
      type: DRAW_OFFER,
      payload: { from: this.getColor(socket) },
    });
  }

  handleDrawAccept(socket: WebSocket): void {
    if (this.isOver) return;
    if (!this.drawOfferedBy || this.drawOfferedBy === socket) return;

    this.endGame({ winner: "draw", reason: "draw_agreement" });
  }

  handleDrawDecline(socket: WebSocket): void {
    if (this.isOver) return;
    if (!this.drawOfferedBy || this.drawOfferedBy === socket) return;

    this.drawOfferedBy = null;
    this.safeSend(this.getOpponent(socket), {
      type: DRAW_DECLINE,
      payload: { from: this.getColor(socket) },
    });
  }

  handleDisconnect(socket: WebSocket): void {
    if (this.isOver) return;
    this.isOver = true;
    clearInterval(this.timer);

    const winner = socket === this.player1 ? "black" : "white";
    const opponent = this.getOpponent(socket);

    this.safeSend(opponent, {
      type: OPPONENT_DISCONNECTED,
      payload: { winner, reason: "disconnect" },
    });

    console.log(`[${this.id}] ${this.getColor(socket)} disconnected, ${winner} wins`);
  }
}
