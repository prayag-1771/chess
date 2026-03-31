"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const ws_1 = require("ws");
const chess_js_1 = require("chess.js");
const messages_1 = require("./messages");
class Game {
    player1; // white
    player2; // black
    board;
    startTime;
    isOver = false;
    drawOfferedBy = null;
    constructor(player1, player2) {
        this.player1 = player1;
        this.player2 = player2;
        this.board = new chess_js_1.Chess();
        this.startTime = new Date();
        this.safeSend(this.player1, {
            type: messages_1.INIT_GAME,
            payload: { color: "white" },
        });
        this.safeSend(this.player2, {
            type: messages_1.INIT_GAME,
            payload: { color: "black" },
        });
    }
    /** Safely send JSON to a socket — no crash if socket is closed */
    safeSend(socket, data) {
        if (socket.readyState === ws_1.WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }
    getOpponent(socket) {
        return socket === this.player1 ? this.player2 : this.player1;
    }
    getColor(socket) {
        return socket === this.player1 ? "white" : "black";
    }
    /** Determine whose turn it is based on chess.js (single source of truth) */
    isPlayersTurn(socket) {
        const turn = this.board.turn(); // 'w' or 'b'
        if (turn === "w" && socket === this.player1)
            return true;
        if (turn === "b" && socket === this.player2)
            return true;
        return false;
    }
    /** Broadcast game-over to both players and mark game as finished */
    endGame(result) {
        if (this.isOver)
            return;
        this.isOver = true;
        const payload = {
            type: messages_1.GAME_OVER,
            payload: result,
        };
        this.safeSend(this.player1, payload);
        this.safeSend(this.player2, payload);
    }
    /** Check if the current board position ends the game */
    checkGameState() {
        if (!this.board.isGameOver())
            return;
        if (this.board.isCheckmate()) {
            this.endGame({
                winner: this.board.turn() === "w" ? "black" : "white",
                reason: "checkmate",
            });
        }
        else if (this.board.isStalemate()) {
            this.endGame({ winner: "draw", reason: "stalemate" });
        }
        else if (this.board.isInsufficientMaterial()) {
            this.endGame({ winner: "draw", reason: "insufficient_material" });
        }
        else if (this.board.isThreefoldRepetition()) {
            this.endGame({ winner: "draw", reason: "threefold_repetition" });
        }
        else if (this.board.isDraw()) {
            this.endGame({ winner: "draw", reason: "fifty_move_rule" });
        }
    }
    makeMove(socket, move) {
        if (this.isOver)
            return;
        // Validate it's this player's turn via chess.js (single source of truth)
        if (!this.isPlayersTurn(socket)) {
            this.safeSend(socket, {
                type: messages_1.INVALID_MOVE,
                payload: { message: "Not your turn" },
            });
            return;
        }
        // Validate move fields
        if (!move ||
            typeof move.from !== "string" ||
            typeof move.to !== "string") {
            this.safeSend(socket, {
                type: messages_1.INVALID_MOVE,
                payload: { message: "Invalid move format: from and to are required" },
            });
            return;
        }
        try {
            // Auto-promote to queen if reaching the last rank without a promotion field
            const moveObj = {
                from: move.from,
                to: move.to,
            };
            // Detect pawn promotion: pawn moving to rank 1 or 8
            const piece = this.board.get(move.from);
            if (piece && piece.type === "p") {
                const toRank = move.to.charAt(1);
                if (toRank === "1" || toRank === "8") {
                    moveObj.promotion = move.promotion || "q"; // default queen
                }
            }
            const result = this.board.move(moveObj);
            if (!result) {
                this.safeSend(socket, {
                    type: messages_1.INVALID_MOVE,
                    payload: { message: "Illegal move" },
                });
                return;
            }
            // Clear any pending draw offer after a move
            this.drawOfferedBy = null;
            // Send the move to the opponent (include promotion if present)
            const movePayload = {
                from: result.from,
                to: result.to,
            };
            if (result.promotion) {
                movePayload.promotion = result.promotion;
            }
            this.safeSend(this.getOpponent(socket), {
                type: messages_1.MOVE,
                payload: movePayload,
            });
            // Check for game-ending conditions
            this.checkGameState();
        }
        catch (e) {
            this.safeSend(socket, {
                type: messages_1.INVALID_MOVE,
                payload: { message: "Illegal move" },
            });
        }
    }
    handleResign(socket) {
        if (this.isOver)
            return;
        const winner = socket === this.player1 ? "black" : "white";
        this.endGame({ winner, reason: "resignation" });
    }
    handleDrawOffer(socket) {
        if (this.isOver)
            return;
        // Can't offer draw to yourself twice in a row
        if (this.drawOfferedBy === socket)
            return;
        this.drawOfferedBy = socket;
        this.safeSend(this.getOpponent(socket), {
            type: messages_1.DRAW_OFFER,
            payload: { from: this.getColor(socket) },
        });
    }
    handleDrawAccept(socket) {
        if (this.isOver)
            return;
        // Only the opponent of the offerer can accept
        if (!this.drawOfferedBy || this.drawOfferedBy === socket)
            return;
        this.endGame({ winner: "draw", reason: "draw_agreement" });
    }
    handleDrawDecline(socket) {
        if (this.isOver)
            return;
        if (!this.drawOfferedBy || this.drawOfferedBy === socket)
            return;
        this.drawOfferedBy = null;
        this.safeSend(this.getOpponent(socket), {
            type: messages_1.DRAW_DECLINE,
            payload: { from: this.getColor(socket) },
        });
    }
    handleDisconnect(socket) {
        if (this.isOver)
            return;
        const winner = socket === this.player1 ? "black" : "white";
        this.endGame({ winner, reason: "disconnect" });
        // Also notify the remaining player specifically
        this.safeSend(this.getOpponent(socket), {
            type: messages_1.OPPONENT_DISCONNECTED,
            payload: {},
        });
    }
}
exports.Game = Game;
//# sourceMappingURL=Game.js.map