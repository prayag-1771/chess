'use client'

import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

function HeroBoard() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.18
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08
  })

  const squares = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight = (col + row) % 2 === 1
      squares.push({ row, col, isLight })
    }
  }

  const heroPieces: { col: number; row: number; height: number; color: string }[] = [
    { col: 4, row: 0, height: 0.58, color: '#F8F4EC' },
    { col: 3, row: 0, height: 0.50, color: '#F8F4EC' },
    { col: 0, row: 0, height: 0.38, color: '#F8F4EC' },
    { col: 7, row: 0, height: 0.38, color: '#F8F4EC' },
    { col: 1, row: 1, height: 0.28, color: '#F8F4EC' },
    { col: 2, row: 1, height: 0.28, color: '#F8F4EC' },
    { col: 5, row: 1, height: 0.28, color: '#F8F4EC' },
    { col: 4, row: 7, height: 0.58, color: '#111111' },
    { col: 3, row: 7, height: 0.50, color: '#111111' },
    { col: 0, row: 7, height: 0.38, color: '#111111' },
    { col: 7, row: 7, height: 0.38, color: '#111111' },
    { col: 1, row: 6, height: 0.28, color: '#111111' },
    { col: 3, row: 6, height: 0.28, color: '#111111' },
    { col: 6, row: 6, height: 0.28, color: '#111111' },
  ]

  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[8.6, 0.18, 8.6]} />
        <meshStandardMaterial color="#2d1c12" roughness={0.4} metalness={0.2} />
      </mesh>

      {squares.map(({ row, col, isLight }) => (
        <mesh
          key={`${row}-${col}`}
          position={[col - 3.5, 0.002, row - 3.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={isLight ? '#F3E5AB' : '#996515'}
            roughness={0.65}
            metalness={0.15}
          />
        </mesh>
      ))}

      {heroPieces.map((p, i) => {
        const x = p.col - 3.5
        const z = p.row - 3.5
        const isWhite = p.color === '#F8F4EC'
        return (
          <group key={i} position={[x, 0.01, z]}>
            <mesh castShadow position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.32, 0.35, 0.08, 24]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.12 : 0.2}
                roughness={isWhite ? 0.3 : 0.2}
              />
            </mesh>
            <mesh castShadow position={[0, p.height / 2, 0]}>
              <cylinderGeometry args={[0.14, 0.2, p.height, 20]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.12 : 0.2}
                roughness={isWhite ? 0.3 : 0.2}
              />
            </mesh>
            <mesh castShadow position={[0, p.height + 0.14, 0]}>
              <sphereGeometry args={[0.18, 20, 20]} />
              <meshStandardMaterial
                color={p.color}
                metalness={isWhite ? 0.12 : 0.2}
                roughness={isWhite ? 0.3 : 0.2}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function OrbitRings() {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = Math.PI / 2.6
      ring1Ref.current.rotation.z = t * 0.25
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = Math.PI / 3.2
      ring2Ref.current.rotation.z = -t * 0.18
    }
  })

  return (
    <>
      <mesh ref={ring1Ref} position={[0, 0.2, 0]}>
        <torusGeometry args={[5.4, 0.015, 8, 100]} />
        <meshBasicMaterial color="#D4AF37" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 0.2, 0]}>
        <torusGeometry args={[6.4, 0.01, 8, 100]} />
        <meshBasicMaterial color="#9b72ff" transparent opacity={0.18} />
      </mesh>
    </>
  )
}

export function HeroScene3D() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 9.5, 12], fov: 42, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.6} />

        <directionalLight
          position={[7, 15, 9]}
          intensity={3}
          color="#FFFDF5"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-6, 7, -5]} intensity={0.6} color="#A8C4E8" />
        <ambientLight intensity={0.4} color="#FFF2DB" />
        <pointLight position={[0, -1, 0]} intensity={1.5} color="#D4AF37" distance={15} decay={2} />

        <Float speed={1.1} rotationIntensity={0.06} floatIntensity={0.4}>
          <HeroBoard />
        </Float>

        <OrbitRings />

        <ContactShadows
          position={[0, -0.6, 0]}
          opacity={0.45}
          scale={20}
          blur={3.5}
          far={4.5}
          color="#050300"
        />
      </Suspense>
    </Canvas>
  )
}
