import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { MathUtils, NeutralToneMapping, PMREMGenerator, Vector3 } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Cloth } from '../../data/cloths'
import { HangerItem } from './HangerItem'
import { Rail } from './Rail'
import type { LightState } from './lightRig'
import type { LoupePoint, Motion } from './railMath'
import { RoomLight } from './RoomLight'

/** Camera facts the hangers read every frame. */
export interface Stage {
  camZ: number
  focusZ: number
  parallax: Vector3
  rayOrigin: Vector3
  rayDir: Vector3
}

export interface RailSceneProps {
  cloths: Cloth[]
  target: number
  focused: boolean
  motion: Motion
  reducedMotion: boolean
  /** 0 morning … 1 lamplight; the room relights toward it. */
  timeOfDay: number
  /** Where on the lifted cloth the pick glass is looking. */
  loupe: LoupePoint
  onSelect: (index: number) => void
  onHover: (index: number | null) => void
  onBackground: () => void
  onReady: () => void
  onPaint: (light: LightState) => void
}

const FOV = 30
const BASE_CAMERA_Z = 5.4
const FIT_WIDTH = 4.5 // world width kept in frame on narrower screens
const FOCUS_DISTANCE = 3.7 // a lifted cloth hangs this far from the lens
const LOOK_Y = -0.06
const WALL_Z = -1
const FLOOR_Y = -1.34 // where the CSS floor meets the wall, at the wall's depth
const WALL_HEIGHT = 4.8
const RAIL_STIFFNESS = 4.6 // spring frequency, rad/s: about a second to settle
const PARALLAX = { x: 0.14, y: 0.06, ease: 2.2 }

export default function RailScene(props: RailSceneProps) {
  const { cloths, motion, focused, target, reducedMotion, loupe } = props
  const stage = useMemo<Stage>(
    () => ({
      camZ: BASE_CAMERA_Z,
      focusZ: BASE_CAMERA_Z - FOCUS_DISTANCE,
      parallax: new Vector3(),
      rayOrigin: new Vector3(),
      rayDir: new Vector3(0, 0, -1),
    }),
    [],
  )

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, BASE_CAMERA_Z] }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping
        gl.toneMappingExposure = 1.02
      }}
      onPointerMissed={props.onBackground}
      aria-hidden="true"
    >
      <Reflections />
      <RoomLight
        stage={stage}
        motion={motion}
        timeOfDay={props.timeOfDay}
        reducedMotion={reducedMotion}
        wall={{ y: FLOOR_Y + WALL_HEIGHT / 2, z: WALL_Z, height: WALL_HEIGHT }}
        onPaint={props.onPaint}
      />
      <ShadowCatcher />
      <CameraRig stage={stage} motion={motion} focused={focused} />
      <RailDriver motion={motion} target={target} reducedMotion={reducedMotion} />
      <Rail focused={focused} />
      <Suspense fallback={null}>
        {cloths.map((cloth, index) => (
          <HangerItem
            key={cloth.id}
            cloth={cloth}
            index={index}
            count={cloths.length}
            target={target}
            focused={focused}
            motion={motion}
            stage={stage}
            reducedMotion={reducedMotion}
            loupe={loupe}
            onSelect={props.onSelect}
            onHover={props.onHover}
          />
        ))}
        <Ready onReady={props.onReady} />
      </Suspense>
    </Canvas>
  )
}

/**
 * Springs the rail to the chosen cloth whenever no hand is on it. Critically damped:
 * it starts from rest and carries on at the speed a drag was released with.
 */
function RailDriver({ motion, target, reducedMotion }: { motion: Motion; target: number; reducedMotion: boolean }) {
  const spring = useRef({ velocity: 0, last: motion.offset })
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    if (dt <= 0) return
    const s = spring.current
    if (motion.dragging || motion.wheeling) {
      s.velocity = MathUtils.lerp(s.velocity, (motion.offset - s.last) / dt, 0.5)
    } else {
      const w = reducedMotion ? 14 : RAIL_STIFFNESS
      s.velocity += (-(motion.offset - target) * w * w - 2 * w * s.velocity) * dt
      motion.offset += s.velocity * dt
    }
    s.last = motion.offset
  }, -3)
  return null
}

function CameraRig({ stage, motion, focused }: { stage: Stage; motion: Motion; focused: boolean }) {
  useFrame(({ camera, size, pointer }, dt) => {
    const aspect = size.width / size.height
    const fitZ = FIT_WIDTH / (2 * Math.tan(MathUtils.degToRad(FOV / 2)) * aspect)
    stage.camZ = Math.max(BASE_CAMERA_Z, fitZ)
    stage.focusZ = stage.camZ - FOCUS_DISTANCE

    // a lifted cloth is close to the lens, so drift less while it is in focus
    const reach = motion.inside ? (focused ? 0.3 : 1) : 0
    const step = Math.min(dt, 1 / 30)
    stage.parallax.x = MathUtils.damp(stage.parallax.x, pointer.x * PARALLAX.x * reach, PARALLAX.ease, step)
    stage.parallax.y = MathUtils.damp(stage.parallax.y, pointer.y * PARALLAX.y * reach, PARALLAX.ease, step)
    camera.position.set(stage.parallax.x, stage.parallax.y, stage.camZ)
    camera.lookAt(stage.parallax.x * 0.3, LOOK_Y, 0)
    camera.updateMatrixWorld()

    stage.rayOrigin.copy(camera.position)
    stage.rayDir.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize()
  }, -2)
  return null
}

/** Soft studio reflections for the brass and the silk; the room's own light does the rest. */
function Reflections() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

/** Invisible wall that only shows the shadows falling on it, over the HTML wall behind. */
function ShadowCatcher() {
  return (
    <mesh position={[0, FLOOR_Y + WALL_HEIGHT / 2, WALL_Z]} receiveShadow>
      <planeGeometry args={[18, WALL_HEIGHT]} />
      <shadowMaterial color="#3d2a18" opacity={0.1} depthWrite={false} />
    </mesh>
  )
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady])
  return null
}
