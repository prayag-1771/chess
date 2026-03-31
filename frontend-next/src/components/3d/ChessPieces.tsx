'use client'

import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

const LATHE_SEGMENTS = 48

function lathe(profile: [number, number][]): THREE.LatheGeometry {
  const points = profile.map(([r, h]) => new THREE.Vector2(r, h))
  const geo = new THREE.LatheGeometry(points, LATHE_SEGMENTS)
  geo.computeVertexNormals()
  return geo
}

function pawnGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.36, 0], [0.36, 0.04], [0.32, 0.07], [0.20, 0.12],
    [0.16, 0.18], [0.14, 0.28], [0.13, 0.38], [0.12, 0.46],
    [0.16, 0.50], [0.17, 0.52], [0.16, 0.55], [0.12, 0.58],
    [0.15, 0.64], [0.19, 0.72], [0.20, 0.80], [0.18, 0.86],
    [0.14, 0.91], [0.08, 0.95], [0, 0.98],
  ])
}

function rookGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.38, 0], [0.38, 0.05], [0.33, 0.09], [0.20, 0.14],
    [0.17, 0.20], [0.15, 0.40], [0.14, 0.56], [0.13, 0.65],
    [0.18, 0.68], [0.25, 0.71], [0.27, 0.74], [0.27, 0.92],
    [0.21, 0.92], [0.21, 0.86], [0.24, 0.86], [0.24, 0.78],
    [0.11, 0.78], [0.11, 0.92], [0, 0.92],
  ])
}

function knightBaseGeometry(): THREE.LatheGeometry {
  return lathe([
    [0, 0], [0.38, 0], [0.38, 0.05], [0.33, 0.09], [0.20, 0.14],
    [0.17, 0.20], [0.16, 0.32], [0.15, 0.42], [0, 0.42],
  ])
}

function knightHeadShape(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.04, 0.14, 0.06, 0.26, 0.02, 0.40)
  shape.bezierCurveTo(-0.01, 0.48, -0.07, 0.52, -0.09, 0.58)
  shape.bezierCurveTo(-0.11, 0.64, -0.07, 0.72, 0.0, 0.76)
  shape.bezierCurveTo(0.07, 0.80, 0.15, 0.78, 0.19, 0.72)
  shape.bezierCurveTo(0.23, 0.66, 0.25, 0.58, 0.25, 0.50)
  shape.bezierCurveTo(0.25, 0.42, 0.21, 0.34, 0.17, 0.28)
  shape.bezierCurveTo(0.15, 0.22, 0.15, 0.16, 0.17, 0.10)
  shape.lineTo(0.19, 0)
  shape.lineTo(0, 0)

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 8,
  })
}

function bishopGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.36, 0], [0.36, 0.05], [0.31, 0.09], [0.18, 0.14],
    [0.15, 0.20], [0.13, 0.38], [0.12, 0.54], [0.11, 0.62],
    [0.15, 0.65], [0.16, 0.67], [0.15, 0.70], [0.11, 0.74],
    [0.17, 0.82], [0.21, 0.92], [0.20, 1.02], [0.16, 1.10],
    [0.09, 1.18], [0.04, 1.22],
    [0.06, 1.24], [0.06, 1.28], [0, 1.30],
  ])
}

function queenGeometry(): THREE.BufferGeometry {
  return lathe([
    [0, 0], [0.39, 0], [0.39, 0.05], [0.34, 0.09], [0.20, 0.14],
    [0.16, 0.22], [0.14, 0.44], [0.13, 0.64], [0.12, 0.78], [0.11, 0.86],
    [0.15, 0.89], [0.16, 0.91], [0.15, 0.94], [0.11, 0.98],
    [0.17, 1.06], [0.22, 1.16], [0.23, 1.26], [0.20, 1.34],
    [0.14, 1.42], [0.07, 1.48],
    [0.09, 1.50], [0.10, 1.54], [0.09, 1.58], [0, 1.60],
  ])
}

function kingBodyGeometry(): THREE.LatheGeometry {
  return lathe([
    [0, 0], [0.40, 0], [0.40, 0.05], [0.35, 0.09], [0.21, 0.15],
    [0.17, 0.24], [0.15, 0.46], [0.14, 0.68], [0.13, 0.82], [0.12, 0.90],
    [0.16, 0.93], [0.17, 0.95], [0.16, 0.98], [0.12, 1.02],
    [0.18, 1.10], [0.24, 1.22], [0.25, 1.34], [0.22, 1.44],
    [0.15, 1.52], [0.08, 1.58], [0, 1.60],
  ])
}

function kingCrossGeometry(): THREE.BufferGeometry {
  const vertical = new THREE.BoxGeometry(0.05, 0.22, 0.05)
  const horizontal = new THREE.BoxGeometry(0.16, 0.05, 0.05)
  vertical.translate(0, 1.71, 0)
  horizontal.translate(0, 1.75, 0)

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
    vertexOffset += counts[i]
  }
  return new THREE.BufferAttribute(merged, 1)
}

const WHITE_MATERIAL_PROPS = {
  color: '#F5EDE0',
  metalness: 0.06,
  roughness: 0.28,
  envMapIntensity: 0.7,
  clearcoat: 0.3,
  clearcoatRoughness: 0.4,
}

const BLACK_MATERIAL_PROPS = {
  color: '#1A1A1A',
  metalness: 0.2,
  roughness: 0.18,
  envMapIntensity: 1.0,
  clearcoat: 0.5,
  clearcoatRoughness: 0.2,
}

const PIECE_SCALE: Record<string, number> = {
  p: 0.38,
  r: 0.40,
  n: 0.40,
  b: 0.38,
  q: 0.38,
  k: 0.38,
}

const geometryCache = new Map<string, { body: THREE.BufferGeometry; head?: THREE.ExtrudeGeometry; cross?: THREE.BufferGeometry }>()

function getGeometries(type: string) {
  if (geometryCache.has(type)) return geometryCache.get(type)!
  let result: { body: THREE.BufferGeometry; head?: THREE.ExtrudeGeometry; cross?: THREE.BufferGeometry }
  switch (type) {
    case 'p': result = { body: pawnGeometry() }; break
    case 'r': result = { body: rookGeometry() }; break
    case 'n': result = { body: knightBaseGeometry(), head: knightHeadShape() }; break
    case 'b': result = { body: bishopGeometry() }; break
    case 'q': result = { body: queenGeometry() }; break
    case 'k': result = { body: kingBodyGeometry(), cross: kingCrossGeometry() }; break
    default: result = { body: pawnGeometry() }
  }
  geometryCache.set(type, result)
  return result
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
  const targetVec = useRef(new THREE.Vector3(...targetPosition))
  const animating = useRef(false)
  const animT = useRef(0)
  const startPos = useRef(new THREE.Vector3(...position))

  const scale = PIECE_SCALE[type] || 0.38
  const materialProps = pieceColor === 'w' ? WHITE_MATERIAL_PROPS : BLACK_MATERIAL_PROPS
  const geometries = useMemo(() => getGeometries(type), [type])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const newTarget = new THREE.Vector3(...targetPosition)
    if (!newTarget.equals(targetVec.current)) {
      targetVec.current.copy(newTarget)
      startPos.current.copy(currentPos.current)
      animating.current = true
      animT.current = 0
    }

    if (animating.current) {
      animT.current = Math.min(animT.current + delta * 3.5, 1)
      const t = 1 - Math.pow(1 - animT.current, 3)

      currentPos.current.lerpVectors(startPos.current, targetVec.current, t)

      const arcHeight = Math.sin(t * Math.PI) * 0.4
      groupRef.current.position.set(
        currentPos.current.x,
        currentPos.current.y + arcHeight,
        currentPos.current.z,
      )

      if (animT.current >= 1) {
        animating.current = false
        currentPos.current.copy(targetVec.current)
      }
    } else {
      groupRef.current.position.copy(currentPos.current)
    }

    if (selected) {
      groupRef.current.position.y += Math.sin(Date.now() * 0.005) * 0.04 + 0.06
    } else if (hovered) {
      groupRef.current.position.y += 0.04
    }
  })

  return (
    <>
      <group
        ref={groupRef}
        position={position}
        scale={[scale, scale, scale]}
        onClick={(e) => { e.stopPropagation(); onClick?.() }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      >
        <mesh geometry={geometries.body} castShadow receiveShadow>
          <meshPhysicalMaterial {...materialProps} />
        </mesh>

        {type === 'n' && geometries.head && (
          <mesh
            geometry={geometries.head as THREE.ExtrudeGeometry}
            position={[-0.10, 0.42, -0.12]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial {...materialProps} />
          </mesh>
        )}

        {type === 'k' && geometries.cross && (
          <mesh geometry={geometries.cross} castShadow>
            <meshPhysicalMaterial {...materialProps} />
          </mesh>
        )}

        {selected && (
          <pointLight
            position={[0, 1.8, 0]}
            intensity={3}
            color="#FFD700"
            distance={4}
            decay={2}
          />
        )}
      </group>
      {/* World-space (board-space) particle trail */}
      <TrailSystem isMoving={animating.current} positionVec={currentPos.current} active={targetPosition[0] !== position[0] || targetPosition[2] !== position[2]} />
    </>
  )
}

function TrailSystem({ isMoving, positionVec, active }: { isMoving: boolean; positionVec: THREE.Vector3, active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useRef(new THREE.Object3D())
  const particles = useRef<Array<{ pos: THREE.Vector3; age: number; maxAge: number; opacity: number }>>([])
  
  useFrame((_, delta) => {
    if (!meshRef.current) return
    
    // Spawn particles if moving
    if (isMoving && active) {
      // Spawn 2 particles per frame
      for (let i = 0; i < 2; i++) {
        if (particles.current.length > 40) break // limit spawn
        particles.current.push({
          pos: positionVec.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.3, 
            0.1 + Math.random() * 0.3, 
            (Math.random() - 0.5) * 0.3
          )),
          age: 0,
          maxAge: 0.4 + Math.random() * 0.4,
          opacity: 1
        })
      }
    }
    
    // Update particles if any exist
    if (particles.current.length > 0) {
      particles.current.forEach(p => {
        p.age += delta
        p.pos.y += delta * 0.2 // float up slightly
      })
      
      particles.current = particles.current.filter(p => p.age < p.maxAge)
      
      particles.current.forEach((p, i) => {
        if (i >= 50) return // max instances
        dummy.current.position.copy(p.pos)
        const scale = 1 - (p.age / p.maxAge)
        dummy.current.scale.set(scale, scale, scale)
        dummy.current.updateMatrix()
        meshRef.current!.setMatrixAt(i, dummy.current.matrix)
      })
      
      // Clear unused instances
      for (let i = particles.current.length; i < 50; i++) {
        dummy.current.scale.set(0, 0, 0)
        dummy.current.updateMatrix()
        meshRef.current!.setMatrixAt(i, dummy.current.matrix)
      }
      
      meshRef.current.instanceMatrix.needsUpdate = true
    }
  })
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 50]}>
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshBasicMaterial color="#FFD700" transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  )
}
