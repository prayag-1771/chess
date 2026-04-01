# Chess 3D - Online Multiplayer

A real-time multiplayer chess game with a 3D board, built with Next.js, Three.js, and WebSocket.

Two players open the site, click Play, get matched, and play chess on an interactive 3D board with live clocks, in-game chat, sound effects, and post-game review.

## Architecture

```
Frontend (Next.js)                    Backend (Node.js)
Port 3000                             Port 8080
                    WebSocket
  Browser  <──────────────────────>  WebSocket Server
                ws://localhost:8080

  - 3D rendering (Three.js)           - Matchmaking
  - UI / sidebar / chat               - Move validation (chess.js)
  - Local clock display                - Authoritative clocks
  - Sound effects                      - Game state management
  - Optimistic move updates            - Chat relay
```

## Project Structure

```
chess/
├── backend1/                        WebSocket game server
│   └── src/
│       ├── index.ts                 Server entry point (port 8080)
│       ├── messages.ts              Message type constants
│       ├── GameManager.ts           Matchmaking, routing, rate limiting
│       └── Game.ts                  Single game: chess logic, clocks, validation
│
├── frontend-next/                   Next.js frontend with 3D
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           Root HTML layout
│       │   ├── page.tsx             Landing page (/)
│       │   ├── game/page.tsx        Game page (/game)
│       │   └── globals.css          All styles
│       ├── components/
│       │   ├── Game.tsx             Main game controller
│       │   ├── Chessboard.tsx       2D board (legacy, unused)
│       │   ├── Button.tsx           Button component
│       │   └── 3d/
│       │       ├── GameScene3D.tsx   3D canvas, lights, camera, particles
│       │       ├── ChessBoard3D.tsx  Board squares, indicators, captured pieces
│       │       ├── ChessPieces.tsx   Piece geometries, materials, animations
│       │       └── HeroScene3D.tsx   Landing page 3D animation
│       ├── hooks/
│       │   ├── useSocket.ts         WebSocket connection hook
│       │   └── useSound.ts          Sound effect playback hook
│       ├── messages.ts              Message type constants (mirrors backend)
│       └── ws_url.ts                WebSocket URL config
│
└── frontend/                        Legacy React+Vite frontend (unused)
```

## Tech Stack

### Backend
- **Node.js** + TypeScript
- **ws** - WebSocket server
- **chess.js** - Chess engine / move validation

### Frontend
- **Next.js 16** + React 19 + TypeScript
- **Three.js** + @react-three/fiber + @react-three/drei - 3D rendering
- **chess.js** - Client-side move validation (optimistic updates)
- **Tailwind CSS 4** - Styling

## Setup

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
# Backend
cd backend1
npm install
npm run dev

# Frontend (separate terminal)
cd frontend-next
npm install
npm run dev
```

Backend runs on `http://localhost:8080` (WebSocket).
Frontend runs on `http://localhost:3000`.

Open two browser tabs to `http://localhost:3000/game` and click Play on both.

### Scripts

**Backend:**
| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc -b` | Compile TypeScript |
| `start` | `node dist/index.js` | Run compiled server |
| `dev` | `tsc -b && node dist/index.js` | Build and run |
| `dev:watch` | `tsc -b --watch & node --watch dist/index.js` | Watch mode |

**Frontend:**
| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Dev server with hot reload |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve production build |

## How It Works

### WebSocket Message Protocol

All communication uses JSON over WebSocket. Both sides share the same message type constants.

#### Client to Server

**Start a game:**
```json
{
  "type": "init_game",
  "payload": {
    "timeControl": "10+0",
    "roomId": "ABC123"
  }
}
```
`timeControl` is required (`"3+2"`, `"5+0"`, or `"10+0"`). `roomId` is optional (for private rooms).

**Make a move:**
```json
{
  "type": "move",
  "move": { "from": "e2", "to": "e4", "promotion": "q" }
}
```
`promotion` only needed when a pawn reaches the last rank.

**Other actions:**
```json
{ "type": "resign" }
{ "type": "draw_offer" }
{ "type": "draw_accept" }
{ "type": "draw_decline" }
{ "type": "chat", "payload": { "text": "Good game!" } }
```

#### Server to Client

**Game started:**
```json
{
  "type": "init_game",
  "payload": {
    "color": "white",
    "timeLeftMs": { "white": 600000, "black": 600000 }
  }
}
```

**Opponent moved:**
```json
{
  "type": "move",
  "payload": {
    "from": "e7", "to": "e5",
    "timeLeftMs": { "white": 598000, "black": 600000 }
  }
}
```

**Game over:**
```json
{
  "type": "game_over",
  "payload": { "winner": "white", "reason": "checkmate" }
}
```
Reasons: `checkmate`, `stalemate`, `insufficient_material`, `threefold_repetition`, `fifty_move_rule`, `draw_agreement`, `resignation`, `disconnect`, `timeout`.

**Other:**
```json
{ "type": "waiting" }
{ "type": "invalid_move" }
{ "type": "draw_offer" }
{ "type": "draw_decline" }
{ "type": "opponent_disconnected" }
{ "type": "chat", "payload": { "text": "Good game!", "sender": "player1" } }
{ "type": "error", "payload": { "message": "..." } }
```

### Backend Flow

#### Matchmaking (GameManager)

```
Player A sends init_game with timeControl "10+0"
  └─ No one waiting for 10+0?
       → Store A in pendingUsers["10+0"], send WAITING
  └─ Someone waiting?
       → Create Game(A, B), send INIT_GAME to both with colors

Private rooms:
  Player A sends init_game with roomId "ABC123"
    → Store in privateRooms["ABC123"], send WAITING
  Player B sends init_game with roomId "ABC123"
    → Found A! Create Game(A, B), delete room
```

**Safety:**
- Rate limiter: max 30 messages per 5 seconds per client
- Heartbeat: ping every 30s, terminate dead connections
- Input validation on all message types

#### Game Logic (Game)

Each `Game` instance manages one match:

```
Move received from player
  → Is it their turn? (white = player1, black = player2)
  → chess.move() validates with chess.js
  → Update clocks: subtract elapsed, add increment
  → Send move + updated clocks to opponent
  → Check for game-ending conditions
```

**Clock system:**
- Server tracks `timeLeftMs` for both players
- On each move: `elapsed = now - lastMoveTime`, subtract from mover's clock, add increment
- 500ms interval checks for timeout
- Server clocks are authoritative; client clocks are visual estimates

**Game end conditions:**
- Checkmate, stalemate, insufficient material, threefold repetition, 50-move rule
- Resignation, draw agreement, disconnect, timeout

### Frontend Flow

#### Connection

1. `useSocket()` hook creates WebSocket to `ws://localhost:8080`
2. Returns connected socket or null
3. Closes on component unmount

#### Game Component (Game.tsx)

The central controller. Manages all game state and routes WebSocket messages.

**Move flow:**
```
User clicks piece
  → selectedSquare = clicked square
  → Calculate legal moves with chess.moves()
  → Show indicators on board

User clicks destination
  → chess.move() locally (optimistic update)
  → Update board immediately (feels instant)
  → Send move to server
  → Server validates:
      ├── Valid: server sends move to opponent
      └── Invalid: server sends INVALID_MOVE → chess.undo()
```

**Local timer:**
- setInterval every 100ms decrements active player's clock
- Pure visual; server sends corrected times with each move

**Chat:**
- Send: `{ type: "chat", payload: { text } }` to server
- Server relays to opponent
- Messages stored locally in `chatMessages` array
- Unread badge when Chat tab isn't active

**Replay mode:**
- After game over, "Review" button enables stepping through moves
- Uses separate chess.js instance to replay up to current index
- Export as PGN file

#### 3D Scene

**GameScene3D.tsx** - Canvas setup:
```
<Canvas>
  SceneLights       Directional moonlight, point light torches,
                    spotlight on board, ambient fill

  MedievalRoom      Stone floor, pillars, cylindrical table base

  ChessBoard3D      64 squares + pieces + move indicators + captured tray

  FloatingDust      60 instanced gold particles

  ContactShadows    Soft shadow under the board

  OrbitControls     Drag to rotate, scroll to zoom (pan disabled)

  CameraAnimations  Shake on check, zoom on checkmate
</Canvas>
```

**ChessBoard3D.tsx** - Board rendering:
- 8x8 grid of 1x1 squares with wooden frame
- Light squares: `#5D4037`, Dark squares: `#1A110E`
- Selected square: gold highlight
- Legal moves: yellow dots (empty) or red rings (capture)
- Check: pulsing red glow on king's square
- Board rotates 180 degrees for black player
- Captured pieces displayed on sides

**ChessPieces.tsx** - Piece models:
- Each piece type is a lathe geometry (2D profile rotated into 3D)
- White: ivory (`#FAF4E8`), low metalness, slight clearcoat
- Black: obsidian (`#121212`), high metalness, strong clearcoat
- Move animation: arc trajectory with ease-out, gold particle trails
- Selected: float up with sine wobble

**HeroScene3D.tsx** - Landing page:
- Slowly rotating chess board with simplified pieces
- Two decorative orbit rings (gold + purple)
- Gentle floating motion

### Styling

Chess.com-inspired dark theme:
```
Background:  #272522
Surface:     #302e2b
Borders:     #3d3a37
Text:        #c4c2c0
Dim text:    #6d6b69
Green:       #81b64c  (buttons, active clock, chat bubbles)
Red:         #e74c3c  (resign, errors)
```

Right panel has Game/Chat tabs during active games. Flat design, no blur effects.

### Sound Effects

7 audio types loaded from chess.com CDN:
- `pickup` - piece selected
- `place` - normal move
- `capture` - piece captured
- `check` - king in check
- `castle` - castling
- `promote` - pawn promotion
- `gameOver` - game ended

## Features

- Real-time multiplayer via WebSocket
- Quick match (random opponent by time control)
- Private rooms (share room code with friends)
- 3 time controls: Blitz 3+2, Blitz 5+0, Rapid 10+0
- Full FIDE chess rules (via chess.js)
- Pawn promotion with piece selection
- Draw offers and resignation
- In-game chat between players
- 3D board with orbit camera controls
- Piece move animations with particle trails
- Camera shake on check, zoom on checkmate
- Sound effects for all actions
- Post-game review with move navigation
- PGN export
- Captured pieces display
- Disconnect detection
- Rate limiting and heartbeat

## Environment Variables

```bash
# Backend
PORT=8080                # WebSocket server port (default: 8080)

# Frontend
# Edit src/ws_url.ts to change WebSocket URL
# Default: ws://localhost:8080
```

## License

ISC
