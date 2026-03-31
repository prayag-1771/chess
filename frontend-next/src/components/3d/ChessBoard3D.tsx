'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { ChessPiece } from './ChessPieces'

const LIGHT_SQUARE = '#E8D5B5'
const DARK_SQUARE = '#B58863'
const SELECTED_SQUARE = '#F6F669'
const LAST_MOVE_LIGHT = '#CDD26A'
const LAST_MOVE_DARK = '#AAA23A'
const LEGAL_MOVE_COLOR = '#4A4A4A'
const LEGAL_CAPTURE_COLOR = '#CC3333'
const FRAME_COLOR = '#3D2B1F'

interface BoardSquare {
  square: Square
  type: PieceSymbol
  color: Color
}

interface ChessBoard3DProps {
  board: (BoardSquare | null)[][]
  color: string | null
  selectedSquare: Square | null
  legalMoves: Square[]
  lastMove: { from: Square; to: Square } | null
  onSquareClick: (square: Square) => void
  checkSquare?: Square | null
}

function squareToWorld(col: number, row: number): [number, number, number] {
  return [col - 3.5, 0, row - 3.5]
}

function BoardFrame() {
  const outerSize = 8.6
  const frameHeight = 0.18

  return (
    <group position={[0, -0.09, 0]}>
      <mesh position={[0, -0.09, 0]} receiveShadow castShadow>
        <boxGeometry args={[outerSize, frameHeight, outerSize]} />
        <meshPhysicalMaterial
          color={FRAME_COLOR}
          roughness={0.45}
          metalness={0.08}
          clearcoat={0.2}
          clearcoatRoughness={0.6}
        />
      </mesh>
    </group>
  )
}

function getSquareColor(
  squareName: Square,
  isLight: boolean,
  selectedSquare: Square | null,
  lastMove: { from: Square; to: Square } | null,
): string {
  if (selectedSquare === squareName) return SELECTED_SQUARE
  if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) {
    return isLight ? LAST_MOVE_LIGHT : LAST_MOVE_DARK
  }
  return isLight ? LIGHT_SQUARE : DARK_SQUARE
}

function BoardSquares({ board, selectedSquare, legalMoves, lastMove, onSquareClick }: {
  board: (BoardSquare | null)[][]
  selectedSquare: Square | null
  legalMoves: Square[]
  lastMove: { from: Square; to: Square } | null
  onSquareClick: (square: Square) => void
  checkSquare?: Square | null
}) {
  const squares = useMemo(() => {
    const result: { col: number; row: number; isLight: boolean; squareName: Square }[] = []
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const file = col
        const rank = 7 - row
        const squareName = (String.fromCharCode(97 + file) + (rank + 1)) as Square
        const isLight = (col + row) % 2 === 1
        result.push({ col, row, isLight, squareName })
      }
    }
    return result
  }, [])

  return (
    <group>
      {squares.map(({ col, row, isLight, squareName }) => {
        const isLegalMove = legalMoves.includes(squareName)
        const [x, , z] = squareToWorld(col, row)
        const sqColor = getSquareColor(squareName, isLight, selectedSquare, lastMove)
        const hasPiece = board[row]?.[col] !== null

        return (
          <group key={squareName}>
            <mesh
              position={[x, 0.001, z]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onClick={(e) => { e.stopPropagation(); onSquareClick(squareName) }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = 'auto' }}
            >
              <planeGeometry args={[1, 1]} />
              <meshStandardMaterial color={sqColor} roughness={0.75} metalness={0.05} />
            </mesh>

            {isLegalMove && !hasPiece && (
              <mesh position={[x, 0.008, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.16, 20]} />
                <meshStandardMaterial
                  color={LEGAL_MOVE_COLOR}
                  transparent
                  opacity={0.5}
                  roughness={0.6}
                />
              </mesh>
            )}

            {isLegalMove && hasPiece && (
              <mesh position={[x, 0.008, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.40, 0.50, 24]} />
                <meshStandardMaterial
                  color={LEGAL_CAPTURE_COLOR}
                  transparent
                  opacity={0.6}
                  roughness={0.5}
                />
              </mesh>
            )}

            {checkSquare === squareName && (
              <CheckSquarePulse x={x} z={z} />
            )}
          </group>
        )
      })}
    </group>
  )
}

import { useFrame } from '@react-three/fiber'

function CheckSquarePulse({ x, z }: { x: number; z: number }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      const pulse = (Math.sin(clock.elapsedTime * 8) + 1) / 2
      materialRef.current.opacity = 0.4 + pulse * 0.4
    }
  })

  return (
    <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#ff0000"
        transparent
        opacity={0.8}
        emissive="#ff0000"
        emissiveIntensity={0.8}
        roughness={0.2}
      />
    </mesh>
  )
}

interface PieceTracker {
  key: string
  type: PieceSymbol
  pieceColor: 'w' | 'b'
  col: number
  row: number
  prevCol: number
  prevRow: number
}

export function ChessBoard3D({ 
  board, 
  color, 
  selectedSquare, 
  legalMoves, 
  lastMove, 
  onSquareClick, 
  checkSquare 
}: ChessBoard3DProps) {
  const groupRef = useRef<THREE.Group>(null)

  const pieces = useMemo(() => {
    const result: PieceTracker[] = []
    const pieceCounts: Record<string, number> = {}

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row]?.[col]
        if (!piece) continue

        const baseKey = `${piece.color}${piece.type}`
        pieceCounts[baseKey] = (pieceCounts[baseKey] || 0) + 1
        const key = `${baseKey}${pieceCounts[baseKey]}`

        let prevCol = col
        let prevRow = row

        if (lastMove) {
          const toFile = lastMove.to.charCodeAt(0) - 97
          const toRank = parseInt(lastMove.to[1]) - 1
          const toRow = 7 - toRank
          const toCol = toFile

          if (toCol === col && toRow === row) {
            const fromFile = lastMove.from.charCodeAt(0) - 97
            const fromRank = parseInt(lastMove.from[1]) - 1
            prevCol = fromFile
            prevRow = 7 - fromRank
          }
        }

        result.push({ key, type: piece.type, pieceColor: piece.color, col, row, prevCol, prevRow })
      }
    }

    return result
  }, [board, lastMove])

  const rotation: [number, number, number] = color === 'black' ? [0, Math.PI, 0] : [0, 0, 0]

  return (
    <group ref={groupRef} rotation={rotation}>
      <BoardFrame />
      <BoardSquares
        board={board}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        onSquareClick={onSquareClick}
        checkSquare={checkSquare}
      />

      {pieces.map((piece) => {
        const [tx, , tz] = squareToWorld(piece.col, piece.row)
        const [px, , pz] = squareToWorld(piece.prevCol, piece.prevRow)
        const squareName = (
          String.fromCharCode(97 + piece.col) + (8 - piece.row)
        ) as Square
        const isSelected = selectedSquare === squareName

        return (
          <ChessPiece
            key={piece.key}
            type={piece.type}
            pieceColor={piece.pieceColor}
            position={[px, 0.01, pz]}
            targetPosition={[tx, 0.01, tz]}
            selected={isSelected}
            onClick={() => onSquareClick(squareName)}
          />
        )
      })}
    </group>
  )
}
