'use client'

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

/** Slowly rotating chessboard preview for the hero */
function HeroBoard() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    // Gentle auto-rotation
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.18
    // Slight bob
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08
  })

  // Build a mini chess board (8x8 squares)
  const squares = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight = (col + row) % 2 === 1
      squares.push({ row, col, isLight })
    }
  }

  // A few hero pieces scattered on the board
  const heroPieces: { col: number; row: number; height: number; color: string }[] = [
    { col: 4, row: 0, height: 0.55, color: '#F0E6D3' }, // white king
    { col: 3, row: 0, height: 0.48, color: '#F0E6D3' }, // white queen
    { col: 0, row: 0, height: 0.38, color: '#F0E6D3' }, // white rook
    { col: 7, row: 0, height: 0.38, color: '#F0E6D3' }, // white rook
    { col: 1, row: 1, height: 0.28, color: '#F0E6D3' }, // white pawn
    { col: 2, row: 1, height: 0.28, color: '#F0E6D3' },
    { col: 5, row: 1, height: 0.28, color: '#F0E6D3' },
    { col: 4, row: 7, height: 0.55, color: '#1C1C1C' }, // black king
    { col: 3, row: 7, height: 0.48, color: '#1C1C1C' }, // black queen
    { col: 0, row: 7, height: 0.38, color: '#1C1C1C' }, // black rook
    { col: 7, row: 7, height: 0.38, color: '#1C1C1C' }, // black rook
    { col: 1, row: 6, height: 0.28, color: '#1C1C1C' },
    { col: 3, row: 6, height: 0.28, color: '#1C1C1C' },
    { col: 6, row: 6, height: 0.28, color: '#1C1C1C' },
  ]

  return (
    <group ref={groupRef}>
      {/* Board frame */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[8.6, 0.18, 8.6]} />
        <meshStandardMaterial color="#3D2B1F" roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Squares */}
      {squares.map(({ row, col, isLight }) => (
        <mesh
          key={`${row}-${col}`}
          position={[col - 3.5, 0.002, row - 3.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={isLight ? '#E8D5B5' : '#B58863'}
            roughness={0.75}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Hero chess pieces (simplified cylinders + spheres) */}
      {heroPieces.map((p, i) => {
        const x = p.col - 3.5
        const z = p.row - 3.5
        const isWhite = p.color === '#F0E6D3'
        return (
          <group key={i} position={[x, 0.01, z]}>
            {/* Base */}
            <mesh castShadow position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.32, 0.34, 0.08, 20]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.08 : 0.15}
                roughness={isWhite ? 0.35 : 0.25}
              />
            </mesh>
            {/* Stem */}
            <mesh castShadow position={[0, p.height / 2, 0]}>
              <cylinderGeometry args={[0.12, 0.18, p.height, 16]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.08 : 0.15}
                roughness={isWhite ? 0.35 : 0.25}
              />
            </mesh>
            {/* Head */}
            <mesh castShadow position={[0, p.height + 0.14, 0]}>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.08 : 0.15}
                roughness={isWhite ? 0.35 : 0.25}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Orbiting glow rings */
function OrbitRings() {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = Math.PI / 2.5
      ring1Ref.current.rotation.z = t * 0.22
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = Math.PI / 3
      ring2Ref.current.rotation.z = -t * 0.14
    }
  })

  return (
    <>
      <mesh ref={ring1Ref} position={[0, 0.2, 0]}>
        <torusGeometry args={[5.2, 0.018, 8, 80]} />
        <meshBasicMaterial color="#C8A96E" transparent opacity={0.18} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 0.2, 0]}>
        <torusGeometry args={[6.1, 0.012, 8, 80]} />
        <meshBasicMaterial color="#8B6FFF" transparent opacity={0.12} />
      </mesh>
    </>
  )
}

export function HeroScene3D() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 9, 11], fov: 40, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.5} />

        {/* Lighting */}
        <directionalLight
          position={[6, 14, 8]}
          intensity={2.5}
          color="#FFF5E0"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-5, 6, -4]} intensity={0.5} color="#B0C8E8" />
        <ambientLight intensity={0.3} color="#FFE8C8" />
        <pointLight position={[0, -1, 0]} intensity={1.2} color="#C8A96E" distance={12} decay={2} />

        {/* Floating board with animation */}
        <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.3}>
          <HeroBoard />
        </Float>

        {/* Decorative orbit rings */}
        <OrbitRings />

        {/* Shadow */}
        <ContactShadows
          position={[0, -0.5, 0]}
          opacity={0.4}
          scale={18}
          blur={3}
          far={4}
          color="#0A0500"
        />
      </Suspense>
    </Canvas>
  )
}
