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
  public player1: WebSocket; // white
  public player2: WebSocket; // black
  public board: Chess;
  public startTime: Date;
  public isOver: boolean = false;
  private drawOfferedBy: WebSocket | null = null;

  constructor(player1: WebSocket, player2: WebSocket) {
    this.player1 = player1;
    this.player2 = player2;
    this.board = new Chess();
    this.startTime = new Date();

    this.safeSend(this.player1, {
      type: INIT_GAME,
      payload: { color: "white" },
    });
    this.safeSend(this.player2, {
      type: INIT_GAME,
      payload: { color: "black" },
    });
  }

  /** Safely send JSON to a socket — no crash if socket is closed */
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

  /** Determine whose turn it is based on chess.js (single source of truth) */
  private isPlayersTurn(socket: WebSocket): boolean {
    const turn = this.board.turn(); // 'w' or 'b'
    if (turn === "w" && socket === this.player1) return true;
    if (turn === "b" && socket === this.player2) return true;
    return false;
  }

  /** Broadcast game-over to both players and mark game as finished */
  private endGame(result: GameResult): void {
    if (this.isOver) return;
    this.isOver = true;

    const payload = {
      type: GAME_OVER,
      payload: result,
    };
    this.safeSend(this.player1, payload);
    this.safeSend(this.player2, payload);
  }

  /** Check if the current board position ends the game */
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

    // Validate it's this player's turn via chess.js (single source of truth)
    if (!this.isPlayersTurn(socket)) {
      this.safeSend(socket, {
        type: INVALID_MOVE,
        payload: { message: "Not your turn" },
      });
      return;
    }

    // Validate move fields
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
      // Auto-promote to queen if reaching the last rank without a promotion field
      const moveObj: { from: string; to: string; promotion?: string } = {
        from: move.from,
        to: move.to,
      };

      // Detect pawn promotion: pawn moving to rank 1 or 8
      const piece = this.board.get(move.from as any);
      if (piece && piece.type === "p") {
        const toRank = move.to.charAt(1);
        if (toRank === "1" || toRank === "8") {
          moveObj.promotion = move.promotion || "q"; // default queen
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

      // Clear any pending draw offer after a move
      this.drawOfferedBy = null;

      // Send the move to the opponent (include promotion if present)
      const movePayload: { from: string; to: string; promotion?: string } = {
        from: result.from,
        to: result.to,
      };
      if (result.promotion) {
        movePayload.promotion = result.promotion;
      }

      this.safeSend(this.getOpponent(socket), {
        type: MOVE,
        payload: movePayload,
      });

      // Check for game-ending conditions
      this.checkGameState();
    } catch (e) {
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

    // Can't offer draw to yourself twice in a row
    if (this.drawOfferedBy === socket) return;

    this.drawOfferedBy = socket;
    this.safeSend(this.getOpponent(socket), {
      type: DRAW_OFFER,
      payload: { from: this.getColor(socket) },
    });
  }

  handleDrawAccept(socket: WebSocket): void {
    if (this.isOver) return;
    // Only the opponent of the offerer can accept
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

    const winner = socket === this.player1 ? "black" : "white";
    this.endGame({ winner, reason: "disconnect" });

    // Also notify the remaining player specifically
    this.safeSend(this.getOpponent(socket), {
      type: OPPONENT_DISCONNECTED,
      payload: {},
    });
  }
}