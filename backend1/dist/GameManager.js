"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const ws_1 = require("ws");
const messages_1 = require("./messages");
const Game_1 = require("./Game");
/** Simple per-socket rate limiter */
class RateLimiter {
    timestamps = new Map();
    maxMessages;
    windowMs;
    constructor(maxMessages = 30, windowMs = 5000) {
        this.maxMessages = maxMessages;
        this.windowMs = windowMs;
    }
    isAllowed(socket) {
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
    removeSocket(socket) {
        this.timestamps.delete(socket);
    }
}
class GameManager {
    games = [];
    pendingUser = null;
    users = new Set();
    socketToGame = new Map();
    rateLimiter = new RateLimiter();
    addUser(socket) {
        this.users.add(socket);
        this.addHandler(socket);
    }
    removeUser(socket) {
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
    cleanupGame(game) {
        this.games = this.games.filter((g) => g !== game);
        this.socketToGame.delete(game.player1);
        this.socketToGame.delete(game.player2);
    }
    /** Safely send JSON to a socket */
    safeSend(socket, data) {
        if (socket.readyState === ws_1.WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }
    }
    addHandler(socket) {
        socket.on("message", (data) => {
            // Rate limit check
            if (!this.rateLimiter.isAllowed(socket)) {
                this.safeSend(socket, {
                    type: messages_1.ERROR,
                    payload: { message: "Too many messages. Slow down." },
                });
                return;
            }
            // Safe JSON parsing
            let message;
            try {
                message = JSON.parse(data.toString());
            }
            catch {
                this.safeSend(socket, {
                    type: messages_1.ERROR,
                    payload: { message: "Invalid JSON" },
                });
                return;
            }
            if (!message || typeof message.type !== "string") {
                this.safeSend(socket, {
                    type: messages_1.ERROR,
                    payload: { message: "Missing message type" },
                });
                return;
            }
            switch (message.type) {
                case messages_1.INIT_GAME:
                    this.handleInitGame(socket);
                    break;
                case messages_1.MOVE:
                    this.handleMove(socket, message);
                    break;
                case messages_1.RESIGN:
                    this.handleResign(socket);
                    break;
                case messages_1.DRAW_OFFER:
                    this.handleDrawOffer(socket);
                    break;
                case messages_1.DRAW_ACCEPT:
                    this.handleDrawAccept(socket);
                    break;
                case messages_1.DRAW_DECLINE:
                    this.handleDrawDecline(socket);
                    break;
                default:
                    this.safeSend(socket, {
                        type: messages_1.ERROR,
                        payload: { message: `Unknown message type: ${message.type}` },
                    });
            }
        });
    }
    handleInitGame(socket) {
        // Prevent duplicate: user already in a game
        if (this.socketToGame.has(socket)) {
            this.safeSend(socket, {
                type: messages_1.ERROR,
                payload: { message: "You are already in a game" },
            });
            return;
        }
        // Prevent duplicate: user is already pending
        if (this.pendingUser === socket) {
            this.safeSend(socket, {
                type: messages_1.WAITING,
                payload: { message: "Already waiting for an opponent" },
            });
            return;
        }
        if (this.pendingUser) {
            // Verify pending user's socket is still alive
            if (this.pendingUser.readyState !== ws_1.WebSocket.OPEN) {
                this.pendingUser = null;
            }
        }
        if (this.pendingUser && this.pendingUser !== socket) {
            // Match found — create the game
            const game = new Game_1.Game(this.pendingUser, socket);
            this.games.push(game);
            this.socketToGame.set(this.pendingUser, game);
            this.socketToGame.set(socket, game);
            this.pendingUser = null;
            console.log(`Game started: ${this.games.length} active game(s)`);
        }
        else {
            this.pendingUser = socket;
            this.safeSend(socket, {
                type: messages_1.WAITING,
                payload: { message: "Waiting for an opponent..." },
            });
        }
    }
    handleMove(socket, message) {
        const game = this.socketToGame.get(socket);
        if (!game) {
            this.safeSend(socket, {
                type: messages_1.ERROR,
                payload: { message: "You are not in a game" },
            });
            return;
        }
        // Validate move payload
        if (!message.move || typeof message.move !== "object") {
            this.safeSend(socket, {
                type: messages_1.ERROR,
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
    handleResign(socket) {
        const game = this.socketToGame.get(socket);
        if (!game)
            return;
        game.handleResign(socket);
        this.cleanupGame(game);
    }
    handleDrawOffer(socket) {
        const game = this.socketToGame.get(socket);
        if (!game)
            return;
        game.handleDrawOffer(socket);
    }
    handleDrawAccept(socket) {
        const game = this.socketToGame.get(socket);
        if (!game)
            return;
        game.handleDrawAccept(socket);
        if (game.isOver) {
            this.cleanupGame(game);
        }
    }
    handleDrawDecline(socket) {
        const game = this.socketToGame.get(socket);
        if (!game)
            return;
        game.handleDrawDecline(socket);
    }
}
exports.GameManager = GameManager;
//# sourceMappingURL=GameManager.js.map