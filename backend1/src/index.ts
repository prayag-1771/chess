import { WebSocketServer } from "ws";
import { GameManager } from "./GameManager";

const PORT = parseInt(process.env["PORT"] || "8080", 10);

const wss = new WebSocketServer({ port: PORT });
const gameManager = new GameManager();

console.log(`♟ Chess WebSocket server listening on port ${PORT}`);

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin || "unknown";
  console.log(`New connection from ${origin}`);

  gameManager.addUser(ws);

  ws.on("close", () => {
    console.log(`Connection closed (origin: ${origin})`);
    gameManager.removeUser(ws);
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error: ${err.message}`);
    gameManager.removeUser(ws);
  });
});

wss.on("error", (err) => {
  console.error(`Server error: ${err.message}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  wss.close(() => {
    process.exit(0);
  });
});
