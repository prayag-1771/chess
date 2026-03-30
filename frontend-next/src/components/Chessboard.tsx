'use client'

import type { Color, PieceSymbol, Square } from "chess.js";
import { useState } from "react";
import { MOVE } from "../messages";

export const Chessboard = ({ chess, setBoard, board, socket, color }: {
  board: ({
    square: Square;
    type: PieceSymbol;
    color: Color;
  } | null)[][],
  socket: WebSocket,
  chess: any,
  setBoard: any,
  color: String | null
}) => {
  const [from, setFrom] = useState<Square | null>(null);

  const displayBoard = color === 'black' ? [...board].reverse() : board;

  return <div>
    {displayBoard.map((row, i) => {
      const displayRow = color === 'black' ? [...row].reverse() : row;
      return <div key={i} className="flex">
        {displayRow.map((square, j) => {
          const file = color === 'black' ? 7 - j : j;
          const rank = color === 'black' ? i + 1 : 8 - i;
          const squareRepresentation = String.fromCharCode(97 + file) + "" + rank as Square;

          return <div onClick={() => {
            if (!from && square?.color !== color?.substring(0, 1)) {
              setFrom(null);
              return
            } else if (!from) {
              setFrom(squareRepresentation)
            } else {
              chess.move({
                from,
                to: squareRepresentation
              });
              setBoard(chess.board())
              socket.send(JSON.stringify({
                type: MOVE,
                move: {
                  from,
                  to: squareRepresentation
                }
              }))
              setFrom(null);
            }
          }} key={j} className={`w-16 h-16 ${(i + j) % 2 == 0 ? 'bg-[#739552]' : 'bg-[#ebecd0]'}`}>
            <div className="flex justify-center h-full items-center">
              {square ? <img className="w-8" src={`/${square?.color == 'b' ? square.type : `${square?.type?.toUpperCase()} copy`}.png`} alt="" /> : ""}
            </div>
          </div>
        })}
      </div>
    })}
  </div>
}
