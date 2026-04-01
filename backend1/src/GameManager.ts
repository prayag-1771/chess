import { WebSocket } from "ws";
import {
  INIT_GAME,
  MOVE,
  RESIGN,
  DRAW_OFFER,
  DRAW_ACCEPT,
  DRAW_DECLINE,
  CHAT,
  ERROR,
  WAITING,
} from "./messages";
import { Game } from "./Game";

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
  private alive: Set<WebSocket> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const socket of this.users) {
        if (!this.alive.has(socket)) {
          socket.terminate();
          continue;
        }
        this.alive.delete(socket);
        socket.ping();
      }
    }, 30_000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  addUser(socket: WebSocket): void {
    this.users.add(socket);
    this.alive.add(socket);

    socket.on("pong", () => {
      this.alive.add(socket);
    });

    this.addHandler(socket);
  }

  removeUser(socket: WebSocket): void {
    this.users.delete(socket);
    this.alive.delete(socket);
    this.rateLimiter.removeSocket(socket);

    if (this.pendingUser === socket) {
      this.pendingUser = null;
    }
    
    for (const [timeControl, w] of this.pendingUsers.entries()) {
      if (w === socket) this.pendingUsers.delete(timeControl);
    }
    
    for (const [roomId, w] of this.privateRooms.entries()) {
      if (w === socket) this.privateRooms.delete(roomId);
    }

    const game = this.socketToGame.get(socket);
    if (game) {
      game.handleDisconnect(socket);
      this.cleanupGame(game);
    }
  }

  private cleanupGame(game: Game): void {
    this.games = this.games.filter((g) => g !== game);
    this.socketToGame.delete(game.player1);
    this.socketToGame.delete(game.player2);
    console.log(`[${game.id}] cleaned up, ${this.games.length} active game(s)`);
  }

  private safeSend(socket: WebSocket, data: object): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  private addHandler(socket: WebSocket): void {
    socket.on("message", (data) => {
      if (!this.rateLimiter.isAllowed(socket)) {
        this.safeSend(socket, {
          type: ERROR,
          payload: { message: "Too many messages. Slow down." },
        });
        return;
      }

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
          this.handleInitGame(socket, message);
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
        case CHAT:
          this.handleChat(socket, message);
          break;
        default:
          this.safeSend(socket, {
            type: ERROR,
            payload: { message: `Unknown message type: ${message.type}` },
          });
      }
    });
  }

  private pendingUsers: Map<string, WebSocket> = new Map();
  private privateRooms: Map<string, WebSocket> = new Map();

  private handleInitGame(socket: WebSocket, message?: any): void {
    if (this.socketToGame.has(socket)) {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "You are already in a game" },
      });
      return;
    }

    // Default to 10+0 if not provided
    const payload = message?.payload || {};
    const timeControl = payload.timeControl || "10+0";

    if (!["3+2", "5+0", "10+0"].includes(timeControl)) {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "Invalid time control" },
      });
      return;
    }

    const roomId = payload.roomId;
    if (roomId) {
      if (typeof roomId !== 'string' || roomId.length > 30) {
        this.safeSend(socket, { type: ERROR, payload: { message: "Invalid room ID" } });
        return;
      }
      
      const waitingUser = this.privateRooms.get(roomId);
      if (waitingUser && waitingUser !== socket) {
        this.privateRooms.delete(roomId);
        const game = new Game(waitingUser, socket, timeControl);
        
        this.games.push(game);
        this.socketToGame.set(waitingUser, game);
        this.socketToGame.set(socket, game);
        
        console.log(`[GameManager] Private Room Game started! Room: ${roomId}`);
      } else {
        this.privateRooms.set(roomId, socket);
        this.safeSend(socket, { type: WAITING, payload: { message: "Waiting for opponent to join room..." } });
        console.log(`[GameManager] User created/joined private room: ${roomId}`);
      }
      return;
    }

    const pendingUser = this.pendingUsers.get(timeControl);

    if (pendingUser === socket) {
      this.safeSend(socket, {
        type: WAITING,
        payload: { message: "Already waiting for an opponent" },
      });
      return;
    }

    if (pendingUser && pendingUser.readyState !== WebSocket.OPEN) {
      this.pendingUsers.delete(timeControl);
    }

    const validPendingUser = this.pendingUsers.get(timeControl);

    if (validPendingUser && validPendingUser !== socket) {
      const game = new Game(validPendingUser, socket, timeControl);
      this.games.push(game);
      this.socketToGame.set(validPendingUser, game);
      this.socketToGame.set(socket, game);
      this.pendingUsers.delete(timeControl);

      console.log(`${this.games.length} active game(s)`);
    } else {
      this.pendingUsers.set(timeControl, socket);
      this.safeSend(socket, {
        type: WAITING,
        payload: { message: `Waiting for an opponent in ${timeControl}...` },
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

    if (!message.move || typeof message.move !== "object") {
      this.safeSend(socket, {
        type: ERROR,
        payload: { message: "Move data is required" },
      });
      return;
    }

    game.makeMove(socket, message.move);

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

  private handleChat(socket: WebSocket, message: any): void {
    const game = this.socketToGame.get(socket);
    if (!game) {
      console.log("[Chat] No game found for socket");
      return;
    }

    const text = message.payload?.text;
    if (typeof text !== "string" || text.trim().length === 0 || text.length > 500) {
      console.log("[Chat] Invalid text:", text);
      return;
    }

    const opponent = socket === game.player1 ? game.player2 : game.player1;
    const sender = socket === game.player1 ? "player1" : "player2";

    console.log(`[Chat] ${sender} says: "${text.trim()}" -> relaying to opponent`);

    this.safeSend(opponent, {
      type: CHAT,
      payload: { text: text.trim(), sender },
    });
  }
}
