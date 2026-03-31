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
  checkSquare?: Square | null
  isCheckmate?: boolean
}

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
      <meshBasicMaterial color="#D4AF37" transparent opacity={0.3} />
    </instancedMesh>
  )
}

function SceneLights() {
  const torchLight1 = useRef<THREE.PointLight>(null)
  const torchLight2 = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (torchLight1.current) {
      torchLight1.current.intensity = 15 + Math.sin(clock.elapsedTime * 12) * 4
    }
    if (torchLight2.current) {
      torchLight2.current.intensity = 15 + Math.cos(clock.elapsedTime * 10) * 4
    }
  })

  return (
    <>
      {/* Dramatic Moonlight from high window */}
      <directionalLight
        position={[-15, 20, 15]}
        intensity={0.8}
        color="#A5C9FF"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Warm Torchlight / Candle flicker from sides */}
      <pointLight
        ref={torchLight1}
        position={[8, 4, 8]}
        color="#FF8C00"
        distance={25}
        decay={1.8}
        castShadow
      />
      <pointLight
        ref={torchLight2}
        position={[-8, 4, -8]}
        color="#FF4500"
        distance={25}
        decay={1.8}
        castShadow
      />
      <ambientLight intensity={0.08} color="#2A1B0E" />
      <hemisphereLight args={['#201005', '#080502', 0.15]} />
      {/* Subtle floor bounce */}
      <pointLight position={[0, -0.5, 0]} intensity={0.4} color="#8B4513" distance={10} />
    </>
  )
}

function MedievalRoom() {
  const stoneColor = "#2a2a2a"
  const floorColor = "#1a1a1a"
  
  return (
    <group position={[0, -0.2, 0]}>
      {/* Large Stone Table or Base for the board */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[6.5, 7.5, 0.8, 32]} />
        <meshStandardMaterial color={stoneColor} roughness={0.9} metalness={0.1} />
      </mesh>
      
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={floorColor} roughness={1} />
      </mesh>

      {/* Medieval Pillars */}
      {[[-12, -12], [12, -12], [-12, 12], [12, 12]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 9, pz]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 2.5, 20, 16]} />
          <meshStandardMaterial color={stoneColor} roughness={0.8} />
        </mesh>
      ))}

      {/* Floating Torches on Pillars */}
      {[[-9.5, 4.5, -9.5], [9.5, 4.5, 9.5]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
            <meshStandardMaterial color="#443322" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#FF4500" />
            <pointLight intensity={10} distance={15} color="#FF8C00" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#2d2d2d" wireframe />
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
  checkSquare,
  isCheckmate,
}: GameScene3DProps) {
  const cameraY = 8
  const cameraZ = 9 // Constant Z, board rotation handles orientation


  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        position: [0, cameraY, cameraZ],
        fov: 45,
        near: 0.1,
        far: 200,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.95,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: '100%', height: '100%', background: '#080502' }}
    >
      <fog attach="fog" args={['#080502', 10, 50]} />
      <Suspense fallback={<LoadingFallback />}>
        {/* Dark Environment */}
        <Environment preset="night" environmentIntensity={0.05} />

        <SceneLights />
        <MedievalRoom />
        <FloatingDust />

        <ChessBoard3D
          board={board}
          color={color}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={onSquareClick}
          checkSquare={checkSquare}
        />

        <ContactShadows
          position={[0, -0.18, 0]}
          opacity={0.6}
          scale={15}
          blur={2.8}
          far={3.5}
          color="#0d0500"
        />

        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={6}
          maxDistance={18}
          target={[0, 0, 0]}
          makeDefault
        />

        <CameraAnimations 
          isCheck={!!checkSquare} 
          isCheckmate={!!isCheckmate} 
          baseZ={cameraZ} 
          baseY={cameraY} 
        />
      </Suspense>
    </Canvas>
  )
}

function CameraAnimations({ isCheck, isCheckmate, baseZ, baseY }: { isCheck: boolean, isCheckmate: boolean, baseZ: number, baseY: number }) {
  useFrame((state) => {
    // Zoom and Slow-Mo on checkmate
    if (isCheckmate) {
      const targetZ = baseZ * 0.6
      const targetY = baseY * 0.5
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.02)
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetY, 0.02)
      // We don't change 'makeDefault' OrbitControls target here because they fight 
      // but simple lerp creates a nice dramatic slow zoom if OrbitControls isn't actively panning.
      state.camera.lookAt(0, 0, 0)
    } 
    // Camera shake on check
    else if (isCheck) {
      if (!CameraAnimations.checkHandled) {
        CameraAnimations.shakeTime = 0.5 // duration of shake
        CameraAnimations.checkHandled = true
      }
    } else {
      CameraAnimations.checkHandled = false
    }

    if (CameraAnimations.shakeTime > 0) {
      const shakeAmount = CameraAnimations.shakeTime * 0.5
      state.camera.position.x = (Math.random() - 0.5) * shakeAmount
      state.camera.position.y = baseY + (Math.random() - 0.5) * shakeAmount
      state.camera.position.z = baseZ + (Math.random() - 0.5) * shakeAmount
      CameraAnimations.shakeTime -= 0.016
    } else if (!isCheckmate) {
      // gently return to base if not checkmate
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, 0, 0.1)
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, baseY, 0.1)
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, baseZ, 0.1)
    }
  })

  return null
}
CameraAnimations.checkHandled = false
CameraAnimations.shakeTime = 0
