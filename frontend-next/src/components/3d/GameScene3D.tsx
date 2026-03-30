'use client'

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import type { Square } from 'chess.js'
import { ChessBoard3D } from './ChessBoard3D'

interface GameScene3DProps {
  board: any[][]
  color: string | null
  selectedSquare: Square | null
  legalMoves: Square[]
  lastMove: { from: Square; to: Square } | null
  onSquareClick: (square: Square) => void
}

/** Subtle ambient particles floating in the scene */
function FloatingDust() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useRef(new THREE.Object3D())
  const positions = useRef<Float32Array | null>(null)
  const velocities = useRef<Float32Array | null>(null)

  if (!positions.current) {
    const count = 60
    positions.current = new Float32Array(count * 3)
    velocities.current = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions.current[i * 3 + 0] = (Math.random() - 0.5) * 14
      positions.current[i * 3 + 1] = Math.random() * 6
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 14
      velocities.current[i * 3 + 0] = (Math.random() - 0.5) * 0.002
      velocities.current[i * 3 + 1] = Math.random() * 0.004 + 0.001
      velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.002
    }
  }

  useFrame(() => {
    if (!meshRef.current || !positions.current || !velocities.current) return
    const count = 60
    for (let i = 0; i < count; i++) {
      positions.current[i * 3 + 0] += velocities.current[i * 3 + 0]
      positions.current[i * 3 + 1] += velocities.current[i * 3 + 1]
      positions.current[i * 3 + 2] += velocities.current[i * 3 + 2]
      if (positions.current[i * 3 + 1] > 7) positions.current[i * 3 + 1] = 0
      dummy.current.position.set(
        positions.current[i * 3 + 0],
        positions.current[i * 3 + 1],
        positions.current[i * 3 + 2],
      )
      dummy.current.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.current.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 60]}>
      <sphereGeometry args={[0.012, 4, 4]} />
      <meshBasicMaterial color="#C8A96E" transparent opacity={0.25} />
    </instancedMesh>
  )
}

/** Scene lighting setup */
function SceneLights() {
  return (
    <>
      {/* Warm key light from top-front */}
      <directionalLight
        position={[5, 12, 8]}
        intensity={2.2}
        color="#FFF5E0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      {/* Cool fill light from left */}
      <directionalLight position={[-6, 8, -4]} intensity={0.6} color="#B0C8E8" />
      {/* Back rim light */}
      <directionalLight position={[0, 4, -10]} intensity={0.4} color="#E8D0FF" />
      {/* Warm ambient */}
      <ambientLight intensity={0.35} color="#FFE8C8" />
      {/* Floor bounce */}
      <hemisphereLight args={['#1A0A00', '#3D2B1F', 0.3]} />
      {/* Table glow */}
      <pointLight position={[0, -2, 0]} intensity={0.8} color="#8B4513" distance={8} decay={2} />
    </>
  )
}

/** Loading fallback */
function LoadingFallback() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#444" wireframe />
    </mesh>
  )
}

export function GameScene3D({
  board,
  color,
  selectedSquare,
  legalMoves,
  lastMove,
  onSquareClick,
}: GameScene3DProps) {
  // Camera elevation depends on player color
  const cameraY = 8
  const cameraZ = color === 'black' ? -9 : 9

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [0, cameraY, cameraZ],
        fov: 45,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={<LoadingFallback />}>
        {/* Environment map for reflections */}
        <Environment preset="studio" environmentIntensity={0.4} />

        {/* Lights */}
        <SceneLights />

        {/* Floating dust particles */}
        <FloatingDust />

        {/* Main board */}
        <ChessBoard3D
          board={board}
          color={color}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={onSquareClick}
        />

        {/* Soft contact shadow under board */}
        <ContactShadows
          position={[0, -0.18, 0]}
          opacity={0.55}
          scale={14}
          blur={2.5}
          far={3}
          color="#1A0A00"
        />

        {/* Camera orbit controls */}
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={6}
          maxDistance={18}
          target={[0, 0, 0]}
          makeDefault
        />
      </Suspense>
    </Canvas>
  )
}
