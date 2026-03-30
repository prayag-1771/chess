'use client'

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { ChessPiece } from './ChessPieces'

const LIGHT_SQUARE = '#E8D5B5'
const DARK_SQUARE = '#B58863'
const SELECTED_SQUARE = '#F6F669'
const LEGAL_MOVE_COLOR = '#7B61FF'
const FRAME_COLOR = '#3D2B1F'
const FELT_COLOR = '#1A5C2A'

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
}

function squareToWorld(col: number, row: number): [number, number, number] {
  return [col - 3.5, 0, row - 3.5]
}

function BoardFrame() {
  const frameThickness = 0.3
  const boardSize = 8
  const frameHeight = 0.15
  const innerSize = boardSize
  const outerSize = boardSize + frameThickness * 2

  return (
    <group position={[0, -0.08, 0]}>
      <mesh position={[0, -0.075, 0]} receiveShadow>
        <boxGeometry args={[outerSize, frameHeight, outerSize]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} metalness={0.1} />
      </mesh>

      <mesh position={[0, 0.001, 0]} receiveShadow>
        <boxGeometry args={[innerSize, 0.01, innerSize]} />
        <meshStandardMaterial color={FELT_COLOR} roughness={0.9} />
      </mesh>
    </group>
  )
}

function BoardSquares({ selectedSquare, legalMoves, color, onSquareClick }: {
  selectedSquare: Square | null
  legalMoves: Square[]
  color: string | null
  onSquareClick: (square: Square) => void
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
        const isSelected = selectedSquare === squareName
        const isLegalMove = legalMoves.includes(squareName)
        const [x, , z] = squareToWorld(col, row)

        let squareColor = isLight ? LIGHT_SQUARE : DARK_SQUARE
        if (isSelected) squareColor = SELECTED_SQUARE

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
              <meshStandardMaterial color={squareColor} roughness={0.8} metalness={0.05} />
            </mesh>

            {isLegalMove && (
              <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.15, 16]} />
                <meshStandardMaterial
                  color={LEGAL_MOVE_COLOR}
                  transparent
                  opacity={0.6}
                  roughness={0.5}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

function CoordinateLabels({ color }: { color: string | null }) {
  const labels = useMemo(() => {
    const files = 'abcdefgh'
    const result: { text: string; position: [number, number, number]; isFile: boolean }[] = []

    for (let i = 0; i < 8; i++) {
      result.push({
        text: files[i],
        position: [i - 3.5, 0.002, 4.25],
        isFile: true,
      })
    }

    for (let i = 0; i < 8; i++) {
      result.push({
        text: String(8 - i),
        position: [-4.25, 0.002, i - 3.5],
        isFile: false,
      })
    }

    return result
  }, [])

  return (
    <group>
      {labels.map(({ text, position }) => (
        <mesh key={text + position.join(',')} position={position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      ))}
    </group>
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

export function ChessBoard3D({ board, color, selectedSquare, legalMoves, lastMove, onSquareClick }: ChessBoard3DProps) {
  const prevPiecesRef = useRef<Map<string, { col: number; row: number }>>(new Map())
  const groupRef = useRef<THREE.Group>(null)

  const pieces = useMemo(() => {
    const result: PieceTracker[] = []
    const prevPieces = prevPiecesRef.current
    const newPieces = new Map<string, { col: number; row: number }>()

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

        newPieces.set(key, { col, row })
        result.push({ key, type: piece.type, pieceColor: piece.color, col, row, prevCol, prevRow })
      }
    }

    prevPiecesRef.current = newPieces
    return result
  }, [board, lastMove])

  const rotation: [number, number, number] = color === 'black' ? [0, Math.PI, 0] : [0, 0, 0]

  return (
    <group ref={groupRef} rotation={rotation}>
      <BoardFrame />
      <BoardSquares
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        color={color}
        onSquareClick={onSquareClick}
      />
      <CoordinateLabels color={color} />

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
