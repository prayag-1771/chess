import { Button } from "../components/Button"
import { Chessboard } from "../components/Chessboard"
import { useSocket } from "../hooks/useSocket"
import { INIT_GAME, MOVE, GAME_OVER } from "../../../backend1/src/messages.ts"
import { useEffect, useState } from "react"
import { Chess } from "chess.js"


export const Game = () => {
  const [chess, setChess] = useState(new Chess());
  const [board, setBoard] = useState(chess.board());
  const [started, setStarted] = useState(false);
  const [color, setColor] = useState(null);
  const socket = useSocket();

  //   useEffect(() => {
  //   if (color === "black" && board[0][0]?.color === "b") {
  //     setBoard([...board].reverse().map(row => [...row].reverse()));
  //   }
  // }, [color, board])

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(message);
      switch (message.type) {
        case INIT_GAME:
          setStarted(true);
          setColor(message.payload.color);
          console.log(board);
          setBoard(chess.board());
          console.log("Game initialized");
          break;
        case MOVE:
          const move = message.payload;
          chess.move(move);
          setBoard(chess.board())
          console.log("Move made");
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
        <div className={`h-screen ${started? "col-span-6" : "col-span-4"}`}>
          < Chessboard chess={chess} setBoard={setBoard} board={board} socket={socket} color={color} />
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