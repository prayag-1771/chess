import { WebSocket } from "ws";
import { Chess } from "chess.js";
export type GameResult = {
    winner: "white" | "black" | "draw";
    reason: "checkmate" | "stalemate" | "insufficient_material" | "threefold_repetition" | "fifty_move_rule" | "draw_agreement" | "resignation" | "disconnect" | "timeout";
};
export declare class Game {
    readonly id: string;
    player1: WebSocket;
    player2: WebSocket;
    board: Chess;
    startTime: Date;
    isOver: boolean;
    private drawOfferedBy;
    timeLeftMs: {
        white: number;
        black: number;
    };
    private lastMoveTime;
    private incrementMs;
    private timer;
    private hasStarted;
    constructor(player1: WebSocket, player2: WebSocket, timeControl: string);
    private checkTime;
    private safeSend;
    private getOpponent;
    private getColor;
    private isPlayersTurn;
    private endGame;
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
