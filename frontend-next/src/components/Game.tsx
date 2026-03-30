'use client'

import { useSocket } from '../hooks/useSocket'
import { INIT_GAME, MOVE, GAME_OVER } from '../messages'
import { useEffect, useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { GameScene3D } from './3d/GameScene3D'

export const Game = () => {
  const [chess] = useState(() => new Chess())
  const [board, setBoard] = useState(chess.board())
  const [started, setStarted] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [status, setStatus] = useState<string>('')
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      switch (message.type) {
        case INIT_GAME:
          setStarted(true)
          setColor(message.payload.color)
          setBoard(chess.board())
          setStatus('')
          break
        case MOVE: {
          const move = message.payload
          try {
            const result = chess.move(move)
            if (result) {
              setLastMove({ from: result.from as Square, to: result.to as Square })
            }
          } catch {
            // invalid move from server
          }
          setBoard(chess.board())
          setSelectedSquare(null)
          setLegalMoves([])
          break
        }
        case GAME_OVER:
          setStatus('Game Over')
          setStarted(false)
          break
      }
    }
  }, [socket, chess])

  const handleSquareClick = useCallback((square: Square) => {
    if (!started || !socket) return

    const piece = chess.get(square)
    const myColor = color === 'white' ? 'w' : 'b'

    // If clicking own piece, select it and show legal moves
    if (piece && piece.color === myColor) {
      setSelectedSquare(square)
      const moves = chess.moves({ square, verbose: true })
      setLegalMoves(moves.map((m) => m.to as Square))
      return
    }

    // If a square is already selected, try to move
    if (selectedSquare) {
      const move = { from: selectedSquare, to: square }
      try {
        const result = chess.move(move)
        if (result) {
          setLastMove({ from: result.from as Square, to: result.to as Square })
          setBoard(chess.board())
          socket.send(JSON.stringify({ type: MOVE, move: { from: selectedSquare, to: square } }))
        }
      } catch {
        // illegal move – just deselect
      }
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }, [started, socket, chess, color, selectedSquare])

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const currentTurn = chess.turn() === 'w' ? 'White' : 'Black'
  const isMyTurn = color
    ? (color === 'white' && chess.turn() === 'w') || (color === 'black' && chess.turn() === 'b')
    : false
  const inCheck = chess.inCheck()

  return (
    <div className="game-root">
      {/* ── 3D Canvas ── */}
      <div className="game-canvas-area">
        <GameScene3D
          board={board}
          color={color}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
        />
      </div>

      {/* ── Side Panel ── */}
      <aside className="game-panel">
        {/* Logo / title */}
        <div className="panel-logo">
          <span className="logo-icon">♟</span>
          <span className="logo-text">Chess 3D</span>
        </div>

        {/* Connection state */}
        {!socket && (
          <div className="panel-status connecting">
            <span className="pulse-dot" />
            Connecting…
          </div>
        )}

        {/* Pre-game: find match */}
        {socket && !started && (
          <div className="panel-lobby">
            <p className="lobby-title">Find a Match</p>
            <p className="lobby-sub">You&apos;ll be paired with another player</p>
            <button
              id="btn-play-online"
              className="btn-play"
              onClick={() => socket.send(JSON.stringify({ type: INIT_GAME }))}
            >
              <span>▶</span> Play Online
            </button>
            {status && <p className="panel-status gameover">{status}</p>}
          </div>
        )}

        {/* In-game info */}
        {started && (
          <div className="panel-game-info">
            {/* Player indicator */}
            <div className="player-badge">
              <span className={`piece-dot ${color === 'white' ? 'dot-white' : 'dot-black'}`} />
              <span>You play <strong>{color === 'white' ? 'White' : 'Black'}</strong></span>
            </div>

            {/* Turn / check */}
            <div className={`turn-indicator ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
              {inCheck
                ? <><span className="check-icon">⚠</span> Check!</>
                : isMyTurn
                ? <><span className="turn-icon">⬤</span> Your turn</>
                : <><span className="turn-icon dim">⬤</span> {currentTurn}&apos;s turn</>
              }
            </div>

            {/* Subtle hint */}
            <p className="hint-text">Click a piece, then click its destination</p>

            {/* Selected piece */}
            {selectedSquare && (
              <div className="selected-info">
                Selected <strong>{selectedSquare}</strong> — {legalMoves.length} legal move{legalMoves.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* Camera tip */}
            <div className="camera-tip">
              <span>🖱</span> Drag to orbit · Scroll to zoom
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
