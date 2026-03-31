"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const GameManager_1 = require("./GameManager");
const PORT = parseInt(process.env["PORT"] || "8080", 10);
const wss = new ws_1.WebSocketServer({ port: PORT });
const gameManager = new GameManager_1.GameManager();
console.log(`Chess server listening on port ${PORT}`);
wss.on("connection", (ws, req) => {
    const origin = req.headers.origin || "unknown";
    console.log(`connected: ${origin}`);
    gameManager.addUser(ws);
    ws.on("close", () => {
        console.log(`disconnected: ${origin}`);
        gameManager.removeUser(ws);
    });
    ws.on("error", (err) => {
        console.error(`ws error: ${err.message}`);
        gameManager.removeUser(ws);
    });
});
wss.on("error", (err) => {
    console.error(`server error: ${err.message}`);
});
process.on("SIGINT", () => {
    console.log("\nshutting down...");
    gameManager.stopHeartbeat();
    wss.close(() => {
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map