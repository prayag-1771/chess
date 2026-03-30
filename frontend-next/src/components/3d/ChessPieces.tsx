'use client'

import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const LATHE_SEGMENTS = 32

function lathe(profile: [number, number][]): THREE.LatheGeometry {
  const points = profile.map(([r, h]) => new THREE.Vector2(r, h))
  return new THREE.LatheGeometry(points, LATHE_SEGMENTS)
}

function pawnGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.34, 0], [0.34, 0.05], [0.29, 0.09], [0.17, 0.14],
    [0.14, 0.20], [0.12, 0.34], [0.11, 0.46],
    [0.15, 0.50], [0.16, 0.53], [0.15, 0.56], [0.11, 0.60],
    [0.15, 0.66], [0.18, 0.74], [0.18, 0.82], [0.15, 0.88],
    [0.09, 0.93], [0, 0.96],
  ])
}

function rookGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.36, 0], [0.36, 0.06], [0.31, 0.10], [0.19, 0.15],
    [0.16, 0.22], [0.14, 0.45], [0.13, 0.62],
    [0.17, 0.65], [0.24, 0.68], [0.26, 0.72], [0.26, 0.90],
    [0.20, 0.90], [0.20, 0.84], [0.23, 0.84], [0.23, 0.76],
    [0.10, 0.76], [0.10, 0.90], [0, 0.90],
  ])
}

function knightBaseGeometry(): THREE.LatheGeometry {
  return lathe([
    [0, 0], [0.36, 0], [0.36, 0.06], [0.31, 0.10], [0.19, 0.15],
    [0.16, 0.22], [0.15, 0.35], [0.14, 0.42], [0, 0.42],
  ])
}

function knightHeadShape(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.04, 0.12, 0.06, 0.24, 0.02, 0.38)
  shape.bezierCurveTo(-0.01, 0.46, -0.06, 0.50, -0.08, 0.56)
  shape.bezierCurveTo(-0.10, 0.62, -0.06, 0.70, 0.0, 0.74)
  shape.bezierCurveTo(0.06, 0.78, 0.14, 0.76, 0.18, 0.70)
  shape.bezierCurveTo(0.22, 0.64, 0.24, 0.56, 0.24, 0.48)
  shape.bezierCurveTo(0.24, 0.40, 0.20, 0.32, 0.16, 0.26)
  shape.bezierCurveTo(0.14, 0.22, 0.14, 0.16, 0.16, 0.10)
  shape.lineTo(0.18, 0)
  shape.lineTo(0, 0)

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 6,
  })
}

function bishopGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.34, 0], [0.34, 0.06], [0.29, 0.10], [0.17, 0.15],
    [0.14, 0.22], [0.12, 0.42], [0.11, 0.58],
    [0.15, 0.62], [0.16, 0.65], [0.15, 0.68], [0.11, 0.72],
    [0.17, 0.80], [0.20, 0.90], [0.19, 1.00], [0.15, 1.08],
    [0.08, 1.16], [0.03, 1.20],
    [0.05, 1.22], [0.05, 1.26], [0, 1.28],
  ])
}

function queenGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.37, 0], [0.37, 0.06], [0.32, 0.10], [0.19, 0.15],
    [0.15, 0.24], [0.13, 0.48], [0.12, 0.68], [0.11, 0.82],
    [0.15, 0.86], [0.16, 0.89], [0.15, 0.92], [0.11, 0.96],
    [0.16, 1.04], [0.21, 1.14], [0.22, 1.24], [0.19, 1.32],
    [0.13, 1.40], [0.06, 1.44],
    [0.07, 1.46], [0.07, 1.52], [0, 1.54],
  ])
}

function kingBodyGeometry(): THREE.LatheGeometry {
  return lathe([
    [0, 0], [0.38, 0], [0.38, 0.06], [0.33, 0.10], [0.20, 0.16],
    [0.16, 0.26], [0.14, 0.50], [0.13, 0.72], [0.12, 0.86],
    [0.16, 0.90], [0.17, 0.93], [0.16, 0.96], [0.12, 1.00],
    [0.17, 1.08], [0.23, 1.20], [0.24, 1.32], [0.21, 1.42],
    [0.14, 1.50], [0.07, 1.56], [0, 1.58],
  ])
}

function kingCrossGeometry(): THREE.BufferGeometry {
  const vertical = new THREE.BoxGeometry(0.04, 0.20, 0.04)
  const horizontal = new THREE.BoxGeometry(0.14, 0.04, 0.04)

  vertical.translate(0, 1.68, 0)
  horizontal.translate(0, 1.72, 0)

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', mergeAttributes([
    vertical.getAttribute('position') as THREE.BufferAttribute,
    horizontal.getAttribute('position') as THREE.BufferAttribute,
  ]))
  merged.setAttribute('normal', mergeAttributes([
    vertical.getAttribute('normal') as THREE.BufferAttribute,
    horizontal.getAttribute('normal') as THREE.BufferAttribute,
  ]))
  merged.setIndex(mergeIndices([
    vertical.getIndex()!,
    horizontal.getIndex()!,
  ], [
    vertical.getAttribute('position').count,
    horizontal.getAttribute('position').count,
  ]))

  return merged
}

function mergeAttributes(attrs: THREE.BufferAttribute[]): THREE.BufferAttribute {
  const totalCount = attrs.reduce((sum, a) => sum + a.count, 0)
  const itemSize = attrs[0].itemSize
  const merged = new Float32Array(totalCount * itemSize)
  let offset = 0
  for (const a of attrs) {
    merged.set(new Float32Array(a.array), offset)
    offset += a.count * itemSize
  }
  return new THREE.BufferAttribute(merged, itemSize)
}

function mergeIndices(indices: THREE.BufferAttribute[], counts: number[]): THREE.BufferAttribute {
  const totalIndices = indices.reduce((sum, idx) => sum + idx.count, 0)
  const merged = new Uint16Array(totalIndices)
  let indexOffset = 0
  let vertexOffset = 0
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    for (let j = 0; j < idx.count; j++) {
      merged[indexOffset + j] = (idx.array as Uint16Array)[j] + vertexOffset
    }
    indexOffset += idx.count
    if (i > 0) {
      vertexOffset += counts[i - 1]
    } else {
      vertexOffset += counts[0]
    }
  }
  return new THREE.BufferAttribute(merged, 1)
}

const WHITE_MATERIAL_PROPS = {
  color: '#F0E6D3',
  metalness: 0.08,
  roughness: 0.35,
  envMapIntensity: 0.6,
}

const BLACK_MATERIAL_PROPS = {
  color: '#1C1C1C',
  metalness: 0.15,
  roughness: 0.25,
  envMapIntensity: 0.8,
}

const PIECE_SCALE: Record<string, number> = {
  p: 0.38,
  r: 0.40,
  n: 0.40,
  b: 0.38,
  q: 0.38,
  k: 0.38,
}

interface ChessPieceProps {
  type: string
  pieceColor: 'w' | 'b'
  position: [number, number, number]
  targetPosition: [number, number, number]
  selected?: boolean
  onClick?: () => void
}

export function ChessPiece({ type, pieceColor, position, targetPosition, selected, onClick }: ChessPieceProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const currentPos = useRef(new THREE.Vector3(...position))
  const animProgress = useRef(1)

  const scale = PIECE_SCALE[type] || 0.38

  const materialProps = pieceColor === 'w' ? WHITE_MATERIAL_PROPS : BLACK_MATERIAL_PROPS

  const geometries = useMemo(() => {
    switch (type) {
      case 'p': return { body: pawnGeometry() }
      case 'r': return { body: rookGeometry() }
      case 'n': return { body: knightBaseGeometry(), head: knightHeadShape() }
      case 'b': return { body: bishopGeometry() }
      case 'q': return { body: queenGeometry() }
      case 'k': return { body: kingBodyGeometry(), cross: kingCrossGeometry() }
      default: return { body: pawnGeometry() }
    }
  }, [type])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const target = new THREE.Vector3(...targetPosition)
    const dist = currentPos.current.distanceTo(target)

    if (dist > 0.01) {
      animProgress.current = Math.min(animProgress.current + delta * 4, 1)
      currentPos.current.lerp(target, 1 - Math.exp(-12 * delta))

      const liftHeight = Math.sin(animProgress.current * Math.PI) * 0.3
      groupRef.current.position.set(
        currentPos.current.x,
        currentPos.current.y + liftHeight,
        currentPos.current.z,
      )
    } else {
      currentPos.current.copy(target)
      groupRef.current.position.copy(target)
      animProgress.current = 0
    }

    if (selected) {
      groupRef.current.position.y += Math.sin(Date.now() * 0.004) * 0.03 + 0.05
    }

    if (hovered && !selected) {
      groupRef.current.position.y += 0.03
    }
  })

  return (
    <group
      ref={groupRef}
      position={position}
      scale={[scale, scale, scale]}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      <mesh geometry={geometries.body} castShadow receiveShadow>
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {type === 'n' && geometries.head && (
        <mesh
          geometry={geometries.head as THREE.ExtrudeGeometry}
          position={[-0.09, 0.42, -0.11]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}

      {type === 'k' && geometries.cross && (
        <mesh geometry={geometries.cross} castShadow>
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}

      {(selected || hovered) && (
        <pointLight
          position={[0, 1.5, 0]}
          intensity={selected ? 2 : 0.8}
          color={selected ? '#FFD700' : '#FFFFFF'}
          distance={3}
        />
      )}
    </group>
  )
}
