import { WebSocket } from "ws";
import { Chess } from "chess.js";
export type GameResult = {
    winner: "white" | "black" | "draw";
    reason: "checkmate" | "stalemate" | "insufficient_material" | "threefold_repetition" | "fifty_move_rule" | "draw_agreement" | "resignation" | "disconnect" | "timeout";
};
export declare class Game {
    player1: WebSocket;
    player2: WebSocket;
    board: Chess;
    startTime: Date;
    isOver: boolean;
    private drawOfferedBy;
    constructor(player1: WebSocket, player2: WebSocket);
    /** Safely send JSON to a socket — no crash if socket is closed */
    private safeSend;
    private getOpponent;
    private getColor;
    /** Determine whose turn it is based on chess.js (single source of truth) */
    private isPlayersTurn;
    /** Broadcast game-over to both players and mark game as finished */
    private endGame;
    /** Check if the current board position ends the game */
    private checkGameState;
    makeMove(socket: WebSocket, move: {
        from: string;
        to: string;
        promotion?: string;
    }): void;
    handleResign(socket: WebSocket): void;
    handleDrawOffer(socket: WebSocket): void;
    handleDrawAccept(socket: WebSocket): void;
    handleDrawDecline(socket: WebSocket): void;
    handleDisconnect(socket: WebSocket): void;
}
