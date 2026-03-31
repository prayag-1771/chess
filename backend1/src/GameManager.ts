import { WebSocket } from "ws";
import {
  INIT_GAME,
  MOVE,
  RESIGN,
  DRAW_OFFER,
  DRAW_ACCEPT,
  DRAW_DECLINE,
  ERROR,
  WAITING,
} from "./messages";
import { Game } from "./Game";

/** Simple per-socket rate limiter */
class RateLimiter {
  private timestamps: Map<WebSocket, number[]> = new Map();
  private maxMessages: number;
  private windowMs: number;

  constructor(maxMessages = 30, windowMs = 5000) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
  }

  isAllowed(socket: WebSocket): boolean {
    const now = Date.now();
    let times = this.timestamps.get(socket);
    if (!times) {
      times = [];
      this.timestamps.set(socket, times);
    }
    // Remove timestamps outside the window
    const cutoff = now - this.windowMs;
    while (times.length > 0 && (times[0] ?? 0) < cutoff) {
      times.shift();
    }
    if (times.length >= this.maxMessages) {
      return false;
    }
    times.push(now);
    return true;
  }

  removeSocket(socket: WebSocket): void {
    this.timestamps.delete(socket);
  }
}

export class GameManager {
  private games: Game[] = [];
  private pendingUser: WebSocket | null = null;
  private users: Set<WebSocket> = new Set();
  private socketToGame: Map<WebSocket, Game> = new Map();
  private rateLimiter = new RateLimiter();

  addUser(socket: WebSocket): void {
    this.users.add(socket);
    this.addHandler(socket);
  }

  removeUser(socket: WebSocket): void {
    this.users.delete(socket);
    this.rateLimiter.removeSocket(socket);

    // If the disconnecting user was the pending user, clear them
    if (this.pendingUser === socket) {
      this.pendingUser = null;
    }

    // If the user was in a game, notify the opponent and clean up
    const game = this.socketToGame.get(socket);
    if (game) {
      game.handleDisconnect(socket);
      this.cleanupGame(game);
    }
  }

  /** Remove a finished game from tracking */
  private cleanupGame(game: Game): void {
    this.games = this.games.filter((g) => g !== game);
    this.socketToGame.delete(game.player1);
    this.socketToGame.delete(game.player2);
  }

  /** Safely send JSON to a socket */
  private safeSend(socket: WebSocket, data: object): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  private addHandler(socket: WebSocket): void {
    socket.on("message", (data) => {
      // Rate limit check
      if (!this.rateLimiter.isAllowed(socket)) {
        this.safeSend(socket, {
          type: ERROR,
          payload: { message: "Too many messages. Slow down." },
        });
        return;
      }

      // Safe JSON parsing
      let message: any;
      try {
        message = JSON.parse(data.toString());
      } catch {
        this.safeSend(socket, {
          type: ERROR,
          payload: { message: "Invalid JSON" },
        });
        return;
      }

      if (!message || typeof message.type !== "string") {
        this.safeSend(socket, {
          type: ERROR,
          payload: { message: "Missing message type" },
        });
        return;
      }

      switch (message.type) {
        case INIT_GAME:
          this.handleInitGame(socket);
          break;
        case MOVE:
          this.handleMove(socket, message);
          break;
        case RESIGN:
          this.handleResign(socket);
          break;
        case DRAW_OFFER:
          this.handleDrawOffer(socket);
          break;
        case DRAW_ACCEPT:
          this.handleDrawAccept(socket);
          break;
        case DRAW_DECLINE:
          this.handleDrawDecline(socket);
          break;
        default:
          this.safeSend(socket, {
            type: ERROR,
            payload: { message: `Unknown message type: ${message.type}` },
          });
      }
    });
  }

  private handleInitGame(socket: WebSocket): void {
    // Prevent duplicate: user already in a game
    if (this.socketToGame.has(socket)) {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "You are already in a game" },
      });
      return;
    }

    // Prevent duplicate: user is already pending
    if (this.pendingUser === socket) {
      this.safeSend(socket, {
        type: WAITING,
        payload: { message: "Already waiting for an opponent" },
      });
      return;
    }

    if (this.pendingUser) {
      // Verify pending user's socket is still alive
      if (this.pendingUser.readyState !== WebSocket.OPEN) {
        this.pendingUser = null;
      }
    }

    if (this.pendingUser && this.pendingUser !== socket) {
      // Match found — create the game
      const game = new Game(this.pendingUser, socket);
      this.games.push(game);
      this.socketToGame.set(this.pendingUser, game);
      this.socketToGame.set(socket, game);
      this.pendingUser = null;

      console.log(
        `Game started: ${this.games.length} active game(s)`
      );
    } else {
      this.pendingUser = socket;
      this.safeSend(socket, {
        type: WAITING,
        payload: { message: "Waiting for an opponent..." },
      });
    }
  }

  private handleMove(socket: WebSocket, message: any): void {
    const game = this.socketToGame.get(socket);
    if (!game) {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "You are not in a game" },
      });
      return;
    }

    // Validate move payload
    if (!message.move || typeof message.move !== "object") {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "Move data is required" },
      });
      return;
    }

    game.makeMove(socket, message.move);

    // If game ended after this move, clean up
    if (game.isOver) {
      this.cleanupGame(game);
    }
  }

  private handleResign(socket: WebSocket): void {
    const game = this.socketToGame.get(socket);
    if (!game) return;

    game.handleResign(socket);
    this.cleanupGame(game);
  }

  private handleDrawOffer(socket: WebSocket): void {
    const game = this.socketToGame.get(socket);
    if (!game) return;

    game.handleDrawOffer(socket);
  }

  private handleDrawAccept(socket: WebSocket): void {
    const game = this.socketToGame.get(socket);
    if (!game) return;

    game.handleDrawAccept(socket);
    if (game.isOver) {
      this.cleanupGame(game);
    }
  }

  private handleDrawDecline(socket: WebSocket): void {
    const game = this.socketToGame.get(socket);
    if (!game) return;

    game.handleDrawDecline(socket);
  }
}