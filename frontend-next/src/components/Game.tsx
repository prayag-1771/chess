'use client'

import { useSocket } from '../hooks/useSocket'
import {
  INIT_GAME, MOVE, GAME_OVER,
  RESIGN, DRAW_OFFER, DRAW_ACCEPT, DRAW_DECLINE,
  OPPONENT_DISCONNECTED, WAITING, INVALID_MOVE, CHAT
} from '../messages'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square, to: Square } | null>(null)
  const [confirmModal, setConfirmModal] = useState<'resign' | 'draw' | null>(null)
  const [roomIdInput, setRoomIdInput] = useState('')
  const [roomUrl, setRoomUrl] = useState('')
  const [reviewMode, setReviewMode] = useState(false)
  const [replayIndex, setReplayIndex] = useState<number>(0)
  const [chatMessages, setChatMessages] = useState<{ text: string; from: 'me' | 'opponent' }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [activeTab, setActiveTab] = useState<'game' | 'chat'>('game')
  const [unreadChat, setUnreadChat] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

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
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const room = urlParams.get('room')
      if (room) {
        setRoomIdInput(room)
      }
    }
  }, [])

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
          setReviewMode(false)
          setReplayIndex(chess.history().length)

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

        case CHAT: {
          const chatText = message.payload?.text
          if (chatText) {
            setChatMessages(prev => [...prev, { text: chatText, from: 'opponent' }])
            setUnreadChat(prev => prev + 1)
          }
          break
        }

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

      // Check if it is a pawn reaching the end rank
      if (selectedPiece && selectedPiece.type === 'p') {
        const toRank = square.charAt(1)
        if (toRank === '1' || toRank === '8') {
          // Check if pseudo-legal by testing a queen promotion
          try {
            const clone = new Chess(chess.fen())
            const res = clone.move({ from: selectedSquare, to: square, promotion: 'q' })
            if (res) {
              setPendingPromotion({ from: selectedSquare, to: square })
              return
            }
          } catch {
            setSelectedSquare(null)
            setLegalMoves([])
            return
          }
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

  const handlePromotionSelect = useCallback((pieceType: string) => {
    if (!pendingPromotion || !socket) return
    const moveObj = {
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion: pieceType,
    }
    try {
      const result = chess.move(moveObj)
      if (result) {
        setLastMove({ from: result.from as Square, to: result.to as Square })
        setBoard(chess.board())
        playMoveSound(result, chess.inCheck())
        socket.send(JSON.stringify({
          type: MOVE,
          move: moveObj,
        }))
      }
    } catch {}
    setPendingPromotion(null)
    setSelectedSquare(null)
    setLegalMoves([])
  }, [pendingPromotion, chess, socket, playMoveSound])

  const handleResign = useCallback(() => {
    if (!started || !socket) return
    socket.send(JSON.stringify({ type: RESIGN }))
    setConfirmModal(null)
  }, [started, socket])

  const handleDrawOffer = useCallback(() => {
    if (!started || !socket) return
    socket.send(JSON.stringify({ type: DRAW_OFFER }))
    setConfirmModal(null)
  }, [started, socket])

  const handleCreateRoom = useCallback(() => {
    if (!socket) return
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    window.history.pushState({}, '', `?room=${newRoomId}`)
    setRoomUrl(`${window.location.origin}?room=${newRoomId}`)
    socket.send(JSON.stringify({
      type: INIT_GAME,
      payload: { timeControl, roomId: newRoomId }
    }))
    setWaitingForOpponent(true)
    playSound('place')
  }, [socket, timeControl, playSound])

  const handleJoinRoom = useCallback(() => {
    if (!socket || !roomIdInput) return
    window.history.pushState({}, '', `?room=${roomIdInput}`)
    socket.send(JSON.stringify({
      type: INIT_GAME,
      payload: { timeControl, roomId: roomIdInput }
    }))
    setWaitingForOpponent(true)
    playSound('place')
  }, [socket, roomIdInput, timeControl, playSound])

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

  const sendChat = useCallback(() => {
    if (!socket || !chatInput.trim()) return
    const text = chatInput.trim()
    socket.send(JSON.stringify({ type: CHAT, payload: { text } }))
    setChatMessages(prev => [...prev, { text, from: 'me' }])
    setChatInput('')
  }, [socket, chatInput])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (activeTab === 'chat') setUnreadChat(0)
  }, [activeTab, chatMessages])

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
    setReviewMode(false)
    setChatMessages([])
    setUnreadChat(0)
    setActiveTab('game')
  }, [chess])

  const displayBoard = useMemo(() => {
    if (!reviewMode || replayIndex === chess.history().length) {
      return board
    }
    const tempChess = new Chess()
    const history = chess.history({ verbose: true })
    for(let i = 0; i < replayIndex; i++) {
      tempChess.move(history[i])
    }
    return tempChess.board()
  }, [board, replayIndex, chess, reviewMode])

  const displayLastMove = useMemo(() => {
    if (!reviewMode || replayIndex === chess.history().length) return lastMove
    if (replayIndex === 0) return null
    const history = chess.history({ verbose: true })
    const turn = history[replayIndex - 1]
    return { from: turn.from as Square, to: turn.to as Square }
  }, [lastMove, replayIndex, chess, reviewMode])

  const currentTurn = chess.turn() === 'w' ? 'White' : 'Black'
  const isMyTurn = color
    ? (color === 'white' && chess.turn() === 'w') || (color === 'black' && chess.turn() === 'b')
    : false
  const inCheck = chess.inCheck()
  const isCheckmate = chess.isGameOver() && chess.isCheckmate()

  const getKingSquare = (c: 'w' | 'b'): Square | null => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const sq = (String.fromCharCode(97 + j) + (8 - i)) as Square
        const p = chess.get(sq)
        if (p && p.type === 'k' && p.color === c) return sq
      }
    }
    return null
  }
  
  const checkSquare = inCheck ? getKingSquare(chess.turn()) : null

  return (
    <div className="game-root">
      <div className="game-canvas-area">
        <GameScene3D
          board={displayBoard}
          color={color}
          selectedSquare={reviewMode ? null : selectedSquare}
          legalMoves={reviewMode ? [] : legalMoves}
          lastMove={displayLastMove}
          onSquareClick={reviewMode ? () => {} : handleSquareClick}
          checkSquare={checkSquare}
          isCheckmate={isCheckmate}
        />

        {/* Promotion Picker Modal */}
        {pendingPromotion && (
          <div className="modal-overlay">
            <div className="promotion-modal">
              <p>Promote Pawn</p>
              <div className="promo-buttons">
                {['q', 'r', 'b', 'n'].map(p => (
                  <button key={p} className="btn-promo" onClick={() => handlePromotionSelect(p)}>
                    {color === 'white' 
                      ? (p === 'q' ? '♕' : p === 'r' ? '♖' : p === 'b' ? '♗' : '♘')
                      : (p === 'q' ? '♛' : p === 'r' ? '♜' : p === 'b' ? '♝' : '♞')}
                  </button>
                ))}
              </div>
              <button className="btn-cancel" onClick={() => {
                setPendingPromotion(null);
                setSelectedSquare(null);
                setLegalMoves([]);
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Confirm Modal for Resign / Draw */}
        {confirmModal && (
          <div className="modal-overlay">
            <div className="confirm-modal">
              <p>{confirmModal === 'resign' ? 'Are you sure you want to resign?' : 'Offer a draw to your opponent?'}</p>
              <div className="confirm-buttons">
                <button className="btn-accept" onClick={confirmModal === 'resign' ? handleResign : handleDrawOffer}>
                  Yes
                </button>
                <button className="btn-decline" onClick={() => setConfirmModal(null)}>
                  No
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="game-panel">
        <div className="panel-header">
          <div className="panel-logo">
            <span className="logo-icon">♟</span>
            <span className="logo-text">Chess 3D</span>
          </div>
          {(started || reviewMode) && (
            <div className="panel-tabs">
              <button className={`panel-tab ${activeTab === 'game' ? 'active' : ''}`} onClick={() => setActiveTab('game')}>
                Game
              </button>
              <button className={`panel-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                Chat
                {unreadChat > 0 && activeTab !== 'chat' && (
                  <span className="chat-badge">{unreadChat}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {!socket && (
          <div className="panel-status connecting">
            <span className="pulse-dot" />
            Connecting…
          </div>
        )}

        {socket && !started && !reviewMode && (
          <div className="panel-lobby">
            {gameResult ? (
              <>
                <p className="lobby-title game-result">
                  {gameResult.winner === 'draw'
                    ? 'Draw'
                    : gameResult.winner === color
                    ? 'You Win!'
                    : 'You Lost'}
                </p>
                <p className="lobby-sub">{formatReason(gameResult.reason)}</p>
                <div className="result-actions">
                  <button
                    id="btn-play-again"
                    className="btn-play"
                    onClick={() => {
                      handlePlayAgain()
                      socket.send(JSON.stringify({ type: INIT_GAME, payload: { timeControl } }))
                    }}
                  >
                    New Game
                  </button>
                  <button
                    className="btn-play btn-review"
                    onClick={() => setReviewMode(true)}
                  >
                    Review
                  </button>
                </div>
              </>
            ) : waitingForOpponent ? (
              <>
                <p className="lobby-title">Searching…</p>
                <p className="lobby-sub">Waiting for an opponent</p>
                <div className="searching-spinner" />
                {roomUrl && (
                  <div className="room-share">
                    <p className="room-share-label">Share link with friend:</p>
                    <input
                      type="text"
                      className="room-share-input"
                      readOnly
                      value={roomUrl}
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="lobby-title">New Game</p>
                <p className="lobby-sub">Select time control</p>
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
                  onClick={() => {
                    window.history.pushState({}, '', window.location.pathname)
                    socket.send(JSON.stringify({ type: INIT_GAME, payload: { timeControl } }))
                  }}
                >
                  Play
                </button>

                <div className="room-controls">
                  <span className="room-divider">or play a friend</span>
                  <div className="room-flex">
                    <input
                      type="text"
                      className="room-input"
                      placeholder="Room Code"
                      value={roomIdInput}
                      onChange={(e) => setRoomIdInput(e.target.value)}
                    />
                    <button className="btn-room" onClick={handleJoinRoom} disabled={!roomIdInput}>
                      Join
                    </button>
                  </div>
                  <button className="btn-room btn-create" onClick={handleCreateRoom}>
                    Create Private Room
                  </button>
                </div>
              </>
            )}
            {status && !gameResult && <p className="panel-status gameover">{status}</p>}
          </div>
        )}

        {(started || reviewMode) && activeTab === 'game' && (
          <div className="panel-game-info">
            {/* Opponent clock + badge on top */}
            <div className="player-card">
              <div className="player-card-left">
                <span className={`piece-dot ${color === 'white' ? 'dot-black' : 'dot-white'}`} />
                <span className="player-name">Opponent</span>
              </div>
              {timeLeft && (
                <span className={`clock ${!isMyTurn ? 'clock-active' : ''}`}>
                  {formatTime(color === 'black' ? timeLeft.white : timeLeft.black)}
                </span>
              )}
            </div>

            {/* Move History */}
            <div className="move-history-panel">
              <div className="move-history-list">
                {chess.history().length === 0 && (
                  <div className="moves-empty">No moves yet</div>
                )}
                {chess.history().reduce((result, value, index, array) => {
                  if (index % 2 === 0) {
                    result.push(array.slice(index, index + 2));
                  }
                  return result;
                }, [] as string[][]).map((pair, i) => (
                  <div key={i} className="move-row">
                    <span className="move-number">{i + 1}.</span>
                    <span className={`move-white ${reviewMode && replayIndex === i * 2 + 1 ? 'active-move' : ''}`}>{pair[0]}</span>
                    <span className={`move-black ${reviewMode && replayIndex === i * 2 + 2 ? 'active-move' : ''}`}>{pair[1] || ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Your clock + badge on bottom */}
            <div className="player-card">
              <div className="player-card-left">
                <span className={`piece-dot ${color === 'white' ? 'dot-white' : 'dot-black'}`} />
                <span className="player-name">You ({color === 'white' ? 'White' : 'Black'})</span>
              </div>
              {timeLeft && (
                <span className={`clock ${isMyTurn ? 'clock-active' : ''}`}>
                  {formatTime(color === 'white' ? timeLeft.white : timeLeft.black)}
                </span>
              )}
            </div>

            {/* Status bar */}
            <div className={`status-bar ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
              {inCheck
                ? 'Check!'
                : isMyTurn
                ? 'Your turn'
                : `${currentTurn}'s turn`
              }
            </div>

            {/* Draw offer received */}
            {drawOffered && !reviewMode && (
              <div className="draw-offer-bar">
                <p>Opponent offers a draw</p>
                <div className="draw-buttons">
                  <button className="btn-accept" onClick={handleDrawAccept}>Accept</button>
                  <button className="btn-decline" onClick={handleDrawDecline}>Decline</button>
                </div>
              </div>
            )}

            {/* Action buttons or Replay UI */}
            {!reviewMode ? (
              <div className="game-actions">
                <button className="btn-action btn-draw" onClick={() => setConfirmModal('draw')} title="Offer Draw">
                  Draw
                </button>
                <button className="btn-action btn-resign" onClick={() => setConfirmModal('resign')} title="Resign">
                  Resign
                </button>
              </div>
            ) : (
              <div className="replay-controls">
                <div className="replay-nav">
                  <button className="btn-action" onClick={() => setReplayIndex(0)}>|&lt;</button>
                  <button className="btn-action" onClick={() => setReplayIndex(i => Math.max(0, i - 1))}>&lt;</button>
                  <button className="btn-action" onClick={() => setReplayIndex(i => Math.min(chess.history().length, i + 1))}>&gt;</button>
                  <button className="btn-action" onClick={() => setReplayIndex(chess.history().length)}>&gt;|</button>
                </div>
                <div className="replay-extra">
                  <button className="btn-action" onClick={() => {
                    const blob = new Blob([chess.pgn()], { type: "text/plain;charset=utf-8" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = "game.pgn"
                    a.click()
                  }}>Export PGN</button>
                  <button className="btn-action" onClick={() => setReviewMode(false)}>Exit Review</button>
                </div>
              </div>
            )}
          </div>
        )}

        {(started || reviewMode) && activeTab === 'chat' && (
          <div className="chat-panel">
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="chat-empty">No messages yet. Say hello!</div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.from === 'me' ? 'chat-msg-me' : 'chat-msg-opp'}`}>
                  <span className="chat-msg-label">{msg.from === 'me' ? 'You' : 'Opponent'}</span>
                  <span className="chat-msg-text">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input-bar">
              <input
                type="text"
                className="chat-input"
                placeholder="Send a message…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendChat() }}
                maxLength={500}
              />
              <button className="chat-send-btn" onClick={sendChat} disabled={!chatInput.trim()}>
                Send
              </button>
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
