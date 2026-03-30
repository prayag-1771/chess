import { Game } from '@/components/Game'

export const metadata = {
  title: 'Play Chess 3D — Online Multiplayer',
  description: 'Play a real-time 3D chess game against opponents online.',
}

export default function GamePage() {
  return (
    <div className="game-page">
      <Game />
    </div>
  )
}
