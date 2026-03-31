import { WebSocket } from "ws";
export declare class GameManager {
    private games;
    private pendingUser;
    private users;
    private socketToGame;
    private rateLimiter;
    private alive;
    private heartbeatInterval;
    constructor();
    private startHeartbeat;
    stopHeartbeat(): void;
    addUser(socket: WebSocket): void;
    removeUser(socket: WebSocket): void;
    private cleanupGame;
    private safeSend;
    private addHandler;
    private pendingUsers;
    private privateRooms;
    private handleInitGame;
    private handleMove;
    private handleResign;
    private handleDrawOffer;
    private handleDrawAccept;
    private handleDrawDecline;
}
