"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const ws_1 = require("ws");
const chess_js_1 = require("chess.js");
const messages_1 = require("./messages");
const crypto_1 = require("crypto");
class Game {
    id;
    player1;
    player2;
    board;
    startTime;
    isOver = false;
    drawOfferedBy = null;
    constructor(player1, player2) {
        this.id = (0, crypto_1.randomUUID)().slice(0, 8);
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
        console.log(`[${this.id}] game created`);
    }
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
    isPlayersTurn(socket) {
        const turn = this.board.turn();
        if (turn === "w" && socket === this.player1)
            return true;
        if (turn === "b" && socket === this.player2)
            return true;
        return false;
    }
    endGame(result) {
        if (this.isOver)
            return;
        this.isOver = true;
        const payload = { type: messages_1.GAME_OVER, payload: result };
        this.safeSend(this.player1, payload);
        this.safeSend(this.player2, payload);
        console.log(`[${this.id}] game over: ${result.winner} wins (${result.reason})`);
    }
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
        if (!this.isPlayersTurn(socket)) {
            this.safeSend(socket, {
                type: messages_1.INVALID_MOVE,
                payload: { message: "Not your turn" },
            });
            return;
        }
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
            const moveObj = {
                from: move.from,
                to: move.to,
            };
            const piece = this.board.get(move.from);
            if (piece && piece.type === "p") {
                const toRank = move.to.charAt(1);
                if (toRank === "1" || toRank === "8") {
                    moveObj.promotion = move.promotion || "q";
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
            this.drawOfferedBy = null;
            console.log(`[${this.id}] ${this.getColor(socket)} plays ${result.from}-${result.to}${result.promotion ? "=" + result.promotion : ""}`);
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
            this.checkGameState();
        }
        catch {
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
        this.isOver = true;
        const winner = socket === this.player1 ? "black" : "white";
        const opponent = this.getOpponent(socket);
        this.safeSend(opponent, {
            type: messages_1.OPPONENT_DISCONNECTED,
            payload: { winner, reason: "disconnect" },
        });
        console.log(`[${this.id}] ${this.getColor(socket)} disconnected, ${winner} wins`);
    }
}
exports.Game = Game;
//# sourceMappingURL=Game.js.map