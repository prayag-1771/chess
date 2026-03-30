'use client'

import { Button } from "./Button"
import { Chessboard } from "./Chessboard"
import { useSocket } from "../hooks/useSocket"
import { INIT_GAME, MOVE, GAME_OVER } from "../messages"
import { useEffect, useState } from "react"
import { Chess } from "chess.js"

export const Game = () => {
  const [chess, setChess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [started, setStarted] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case INIT_GAME:
          setStarted(true);
          setColor(message.payload.color);
          setBoard(chess.board());
          break;
        case MOVE:
          const move = message.payload;
          chess.move(move);
          setBoard(chess.board())
          break;
        case GAME_OVER:
          console.log("Game Over")
          break;
      }
    }
  }, [socket])

  if (!socket) return <div className="text-white">Connecting...</div>

  return <div>
    <div className="max-w-screen pt-10 flex justify-center">
      <div className="grid grid-cols-6 gap-4">
        <div className={`h-screen ${started ? "col-span-6" : "col-span-4"}`}>
          <Chessboard chess={chess} setBoard={setBoard} board={board} socket={socket} color={color} />
        </div>
        <div className="flex justify-center items-center max-h-120 ml-15">
          {!started && <Button onClick={() => {
            socket.send(JSON.stringify({
              type: INIT_GAME
            }))
          }}>
            Play
          </Button>}
        </div>
      </div>
    </div>
  </div>
}
