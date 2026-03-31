import { WebSocket } from "ws";
export declare class GameManager {
    private games;
    private pendingUser;
    private users;
    private socketToGame;
    private rateLimiter;
    addUser(socket: WebSocket): void;
    removeUser(socket: WebSocket): void;
    /** Remove a finished game from tracking */
    private cleanupGame;
    /** Safely send JSON to a socket */
    private safeSend;
    private addHandler;
    private handleInitGame;
    private handleMove;
    private handleResign;
    private handleDrawOffer;
    private handleDrawAccept;
    private handleDrawDecline;
}
