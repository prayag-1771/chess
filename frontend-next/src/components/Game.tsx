'use client'

import { useSocket } from '../hooks/useSocket'
import {
  INIT_GAME, MOVE, GAME_OVER,
  RESIGN, DRAW_OFFER, DRAW_ACCEPT, DRAW_DECLINE,
  OPPONENT_DISCONNECTED, WAITING, INVALID_MOVE
} from '../messages'
import { useEffect, useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import type { Square, Move } from 'chess.js'
import { GameScene3D } from './3d/GameScene3D'
import { useSound } from '../hooks/useSound'

type GameOverResult = {
  winner: 'white' | 'black' | 'draw'
  reason: string
}

export const Game = () => {
  const [chess] = useState(() => new Chess())
  const [board, setBoard] = useState(chess.board())
  const [started, setStarted] = useState(false)
  const [color, setColor] = useState<string | null>(null)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [status, setStatus] = useState<string>('')
  const [gameResult, setGameResult] = useState<GameOverResult | null>(null)
  const [drawOffered, setDrawOffered] = useState(false)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)
  const [timeControl, setTimeControl] = useState('10+0')
  const [timeLeft, setTimeLeft] = useState<{ white: number, black: number } | null>(null)
  
  const socket = useSocket()
  const playSound = useSound()

  const playMoveSound = useCallback((result: Move, isCheck: boolean) => {
    if (isCheck) {
      playSound('check')
    } else if (result.flags.includes('p')) {
      playSound('promote')
    } else if (result.flags.includes('c') || result.flags.includes('e')) {
      playSound('capture')
    } else if (result.flags.includes('k') || result.flags.includes('q')) {
      playSound('castle')
    } else {
      playSound('place')
    }
  }, [playSound])

  useEffect(() => {
    if (!socket) return

    socket.onmessage = (event) => {
      let message: any
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }

      switch (message.type) {
        case INIT_GAME:
          setStarted(true)
          setColor(message.payload.color)
          setBoard(chess.board())
          setStatus('')
          setGameResult(null)
          setWaitingForOpponent(false)
          if (message.payload.timeLeftMs) {
            setTimeLeft(message.payload.timeLeftMs)
          }
          break

        case MOVE: {
          const moveData = message.payload
          try {
            const result = chess.move(moveData)
            if (result) {
              setLastMove({ from: result.from as Square, to: result.to as Square })
              playMoveSound(result, chess.inCheck())
            }
          } catch {
            // ignore invalid moves from server
          }
          if (moveData.timeLeftMs) {
            setTimeLeft(moveData.timeLeftMs)
          }
          setBoard(chess.board())
          setSelectedSquare(null)
          setLegalMoves([])
          break
        }

        case GAME_OVER: {
          const result = message.payload as GameOverResult
          setGameResult(result)
          setStarted(false)

          if (result.winner === 'draw') {
            setStatus(`Draw — ${formatReason(result.reason)}`)
          } else {
            setStatus(`${capitalize(result.winner)} wins — ${formatReason(result.reason)}`)
          }
          playSound('gameOver')
          break
        }

        case OPPONENT_DISCONNECTED:
          if (started) {
            setStatus('Opponent disconnected')
            setStarted(false)
          }
          break

        case WAITING:
          setWaitingForOpponent(true)
          break

        case INVALID_MOVE:
          // Undo the local move we optimistically made
          chess.undo()
          setBoard(chess.board())
          break

        case DRAW_OFFER:
          setDrawOffered(true)
          break

        case DRAW_DECLINE:
          setDrawOffered(false)
          break

        default:
          break
      }
    }
  }, [socket, chess, started, playSound, playMoveSound])

  // Local timer tick
  useEffect(() => {
    if (!started || !timeLeft) return
    let lastTick = Date.now()

    const interval = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTick
      lastTick = now

      // Turn logic: we only decrement the active player's clock if at least 1 move has been made
      // White starts. If history length is 0, we can also wait until first move or tick white immediately. 
      // Usually clock starts on first move, but for simplicity let's start it right away.
      const isWhiteTurn = chess.turn() === 'w'
      if (chess.history().length > 0) {
        setTimeLeft(prev => {
          if (!prev) return prev
          const newTime = { ...prev }
          if (isWhiteTurn) newTime.white = Math.max(0, newTime.white - delta)
          else newTime.black = Math.max(0, newTime.black - delta)
          return newTime
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [started, timeLeft, chess])

  const handleSquareClick = useCallback((square: Square) => {
    if (!started || !socket) return

    const piece = chess.get(square)
    const myColor = color === 'white' ? 'w' : 'b'

    // If it's not my turn, don't allow moves
    if (chess.turn() !== myColor) {
      // But allow selecting own pieces for inspection
      if (piece && piece.color === myColor) {
        playSound('pickup')
        setSelectedSquare(square)
        const moves = chess.moves({ square, verbose: true })
        setLegalMoves(moves.map((m) => m.to as Square))
      }
      return
    }

    if (piece && piece.color === myColor) {
      playSound('pickup')
      setSelectedSquare(square)
      const moves = chess.moves({ square, verbose: true })
      setLegalMoves(moves.map((m) => m.to as Square))
      return
    }

    if (selectedSquare) {
      // Build the move — include promotion if needed
      const selectedPiece = chess.get(selectedSquare)
      const moveObj: { from: string; to: string; promotion?: string } = {
        from: selectedSquare,
        to: square,
      }

      // Auto-promote to queen for pawn reaching the last rank
      if (selectedPiece && selectedPiece.type === 'p') {
        const toRank = square.charAt(1)
        if (toRank === '1' || toRank === '8') {
          moveObj.promotion = 'q'
        }
      }

      try {
        const result = chess.move(moveObj)
        if (result) {
          setLastMove({ from: result.from as Square, to: result.to as Square })
          setBoard(chess.board())
          playMoveSound(result, chess.inCheck())
          socket.send(JSON.stringify({
            type: MOVE,
            move: {
              from: selectedSquare,
              to: square,
              ...(moveObj.promotion ? { promotion: moveObj.promotion } : {}),
            },
          }))
        }
      } catch {
        // illegal move — ignore
      }
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }, [started, socket, chess, color, selectedSquare, playSound, playMoveSound])

  const handleResign = useCallback(() => {
    if (!started || !socket) return
    socket.send(JSON.stringify({ type: RESIGN }))
  }, [started, socket])

  const handleDrawOffer = useCallback(() => {
    if (!started || !socket) return
    socket.send(JSON.stringify({ type: DRAW_OFFER }))
  }, [started, socket])

  const handleDrawAccept = useCallback(() => {
    if (!socket) return
    socket.send(JSON.stringify({ type: DRAW_ACCEPT }))
    setDrawOffered(false)
  }, [socket])

  const handleDrawDecline = useCallback(() => {
    if (!socket) return
    socket.send(JSON.stringify({ type: DRAW_DECLINE }))
    setDrawOffered(false)
  }, [socket])

  const handlePlayAgain = useCallback(() => {
    chess.reset()
    setBoard(chess.board())
    setSelectedSquare(null)
    setLegalMoves([])
    setLastMove(null)
    setStatus('')
    setGameResult(null)
    setDrawOffered(false)
    setColor(null)
  }, [chess])

  const currentTurn = chess.turn() === 'w' ? 'White' : 'Black'
  const isMyTurn = color
    ? (color === 'white' && chess.turn() === 'w') || (color === 'black' && chess.turn() === 'b')
    : false
  const inCheck = chess.inCheck()

  return (
    <div className="game-root">
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

      <aside className="game-panel">
        <div className="panel-logo">
          <span className="logo-icon">♟</span>
          <span className="logo-text">Chess 3D</span>
        </div>

        {!socket && (
          <div className="panel-status connecting">
            <span className="pulse-dot" />
            Connecting…
          </div>
        )}

        {socket && !started && (
          <div className="panel-lobby">
            {gameResult ? (
              <>
                <p className="lobby-title game-result">
                  {gameResult.winner === 'draw'
                    ? '🤝 Draw'
                    : gameResult.winner === color
                    ? '🏆 You Win!'
                    : '😞 You Lost'}
                </p>
                <p className="lobby-sub">{formatReason(gameResult.reason)}</p>
                <button
                  id="btn-play-again"
                  className="btn-play"
                  onClick={() => {
                    handlePlayAgain()
                    socket.send(JSON.stringify({ type: INIT_GAME, payload: { timeControl } }))
                  }}
                >
                  <span>🔄</span> Play Again
                </button>
              </>
            ) : waitingForOpponent ? (
              <>
                <p className="lobby-title">Searching…</p>
                <p className="lobby-sub">Waiting for an opponent</p>
                <div className="searching-spinner" />
              </>
            ) : (
              <>
                <p className="lobby-title">Find a Match</p>
                <p className="lobby-sub">Select a time control</p>
                <div className="time-controls">
                  {['3+2', '5+0', '10+0'].map(tc => (
                    <button 
                      key={tc}
                      className={`btn-time ${timeControl === tc ? 'active' : ''}`}
                      onClick={() => setTimeControl(tc)}
                    >
                      {tc}
                    </button>
                  ))}
                </div>
                <button
                  id="btn-play-online"
                  className="btn-play"
                  onClick={() => socket.send(JSON.stringify({ type: INIT_GAME, payload: { timeControl } }))}
                >
                  <span>▶</span> Play Online
                </button>
              </>
            )}
            {status && !gameResult && <p className="panel-status gameover">{status}</p>}
          </div>
        )}

        {started && (
          <div className="panel-game-info">
            <div className="player-badge">
              <span className={`piece-dot ${color === 'white' ? 'dot-white' : 'dot-black'}`} />
              <div className="player-badge-info">
                <span>You play <strong>{color === 'white' ? 'White' : 'Black'}</strong></span>
                {timeLeft && (
                  <span className="clock">
                    {formatTime(color === 'white' ? timeLeft.white : timeLeft.black)}
                  </span>
                )}
              </div>
            </div>
            <div className="player-badge">
              <span className={`piece-dot ${color === 'white' ? 'dot-black' : 'dot-white'}`} />
              <div className="player-badge-info">
                <span>Opponent</span>
                {timeLeft && (
                  <span className="clock">
                    {formatTime(color === 'black' ? timeLeft.white : timeLeft.black)}
                  </span>
                )}
              </div>
            </div>

            <div className={`turn-indicator ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
              {inCheck
                ? <><span className="check-icon">⚠</span> Check!</>
                : isMyTurn
                ? <><span className="turn-icon">⬤</span> Your turn</>
                : <><span className="turn-icon dim">⬤</span> {currentTurn}&apos;s turn</>
              }
            </div>

            <p className="hint-text">Click a piece, then click its destination</p>

            {selectedSquare && (
              <div className="selected-info">
                Selected <strong>{selectedSquare}</strong> — {legalMoves.length} legal move{legalMoves.length !== 1 ? 's' : ''}
              </div>
            )}

            {/* Draw offer received */}
            {drawOffered && (
              <div className="draw-offer-bar">
                <p>Opponent offers a draw</p>
                <div className="draw-buttons">
                  <button className="btn-accept" onClick={handleDrawAccept}>Accept</button>
                  <button className="btn-decline" onClick={handleDrawDecline}>Decline</button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="game-actions">
              <button className="btn-action btn-draw" onClick={handleDrawOffer} title="Offer Draw">
                🤝 Draw
              </button>
              <button className="btn-action btn-resign" onClick={handleResign} title="Resign">
                🏳️ Resign
              </button>
            </div>

            {/* Move History Panel */}
            <div className="move-history-panel">
              <h4 className="move-history-title">Move History</h4>
              <div className="move-history-list">
                {chess.history().reduce((result, value, index, array) => {
                  if (index % 2 === 0) {
                    result.push(array.slice(index, index + 2));
                  }
                  return result;
                }, [] as string[][]).map((pair, i) => (
                  <div key={i} className="move-row">
                    <span className="move-number">{i + 1}.</span>
                    <span className="move-white">{pair[0]}</span>
                    <span className="move-black">{pair[1] || ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="camera-tip">
              <span>🖱</span> Drag to orbit · Scroll to zoom
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    checkmate: 'Checkmate',
    stalemate: 'Stalemate',
    insufficient_material: 'Insufficient material',
    threefold_repetition: 'Threefold repetition',
    fifty_move_rule: '50-move rule',
    draw_agreement: 'By agreement',
    resignation: 'Resignation',
    disconnect: 'Opponent disconnected',
    timeout: 'Time expired',
  }
  return map[reason] || reason
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
