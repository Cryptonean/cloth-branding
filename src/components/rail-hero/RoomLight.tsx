import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  MeshLambertMaterial,
  PointsMaterial,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three'
import { sampleLight, type LightState } from './lightRig'
import type { Stage } from './RailScene'
import type { Motion } from './railMath'

const SUN_ANGLE = 0.27
const WINDOW_ANGLE = SUN_ANGLE * 0.62 // the window fills the middle of the sun's cone
const SUN_DRIFT = { x: 0.35, y: 0.12, speed: 0.05 } // even at a standstill, the afternoon passes
const LIGHT_EASE = 2.6 // how quickly the room follows the dial
const PAINT_STEP = 0.006 // smallest change of hour worth repainting the page's walls for
// After dark a ceiling lamp washes the wall behind the rail.
const LAMP = { position: [0.2, 4.6, 3.2] as const, target: [0, 0, -0.4] as const, color: '#ffc58a', angle: 0.5 }
const WALL_SUN_TOP = [0.1, 0.45] as const // world y where light on the wall fades, below the headline

/** Where the sunbeam is, for the dust drifting through it. */
interface Beam {
  origin: Vector3
  axis: Vector3
  strength: number
}

interface WallUniforms {
  uWallTint: { value: Color }
  uWallStrength: { value: number }
}

export interface RoomLightProps {
  stage: Stage
  motion: Motion
  /** Where the dial points: 0 morning … 1 lamplight. The room eases toward it. */
  timeOfDay: number
  reducedMotion: boolean
  wall: { y: number; z: number; height: number }
  onPaint: (light: LightState) => void
}

const srgb = (color: Color, [r, g, b]: readonly number[]): Color => color.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)

/** The window the sun comes through, drawn as a light cookie: white glass, black wall. */
function windowGobo(): Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('RoomLight: 2D canvas unavailable')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.filter = 'blur(6px)' // sun through glass a few metres away has soft edges
  // three tall lights under a transom, in canvas pixels (y down), inside the cone
  const left = 66
  const right = 446
  const top = 87
  const transom = 161
  const bottom = 425
  ctx.fillStyle = '#fff'
  ctx.fillRect(left, top, right - left, bottom - top)
  // slim glazing bars only half-block the sun, so they never read as a mark on the cloth
  ctx.fillStyle = '#7a7a7a'
  const bar = 12
  const paneW = (right - left - bar * 2) / 3
  for (const c of [1, 2]) ctx.fillRect(left + c * paneW + (c - 1) * bar, top, bar, bottom - top)
  ctx.fillRect(left, transom - bar / 2, right - left, bar)
  return new CanvasTexture(canvas)
}

export function RoomLight({ stage, motion, timeOfDay, reducedMotion, wall, onPaint }: RoomLightProps) {
  const sun = useRef<SpotLight>(null)
  const lamp = useRef<SpotLight>(null)
  const sky = useRef<HemisphereLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const gobo = useMemo(windowGobo, [])
  useEffect(() => () => gobo.dispose(), [gobo])
  const wallUniforms = useMemo<WallUniforms>(() => ({ uWallTint: { value: new Color() }, uWallStrength: { value: 1 } }), [])
  const beam = useMemo<Beam>(() => ({ origin: new Vector3(), axis: new Vector3(0, 0, -1), strength: 1 }), [])
  const live = useRef({ t: timeOfDay, sampled: Number.NaN, painted: Number.NaN, light: sampleLight(timeOfDay) })

  useEffect(() => {
    const lampLight = lamp.current
    if (!lampLight) return
    lampLight.target.position.set(...LAMP.target)
    lampLight.target.updateMatrixWorld()
  }, [])

  useFrame(({ clock }, rawDt) => {
    const [s, l, h, r] = [sun.current, lamp.current, sky.current, rim.current]
    if (!s || !l || !h || !r) return
    const state = live.current
    const dt = Math.min(rawDt, 1 / 30)
    state.t = reducedMotion ? timeOfDay : MathUtils.damp(state.t, timeOfDay, LIGHT_EASE, dt)
    if (Math.abs(state.t - timeOfDay) < 1e-4) state.t = timeOfDay

    if (state.t !== state.sampled) {
      const light = sampleLight(state.t)
      state.light = light
      state.sampled = state.t
      s.target.position.set(...light.sun.target)
      s.target.updateMatrixWorld()
      srgb(s.color, light.sun.color)
      s.intensity = light.sun.intensity
      l.intensity = light.lamp
      srgb(h.color, light.sky.color)
      srgb(h.groundColor, light.sky.ground)
      h.intensity = light.sky.intensity
      srgb(r.color, light.rim.color)
      r.intensity = light.rim.intensity
      scene.environmentIntensity = light.environment
      gl.toneMappingExposure = light.exposure
      srgb(wallUniforms.uWallTint.value, light.wallGlow.tint)
      wallUniforms.uWallStrength.value = light.wallGlow.strength
      beam.strength = light.dust
      if (!(Math.abs(state.t - state.painted) < PAINT_STEP) || state.t === timeOfDay) {
        onPaint(light)
        state.painted = state.t
      }
    }

    const drift = reducedMotion ? 0 : clock.elapsedTime * SUN_DRIFT.speed
    const [x, y, z] = state.light.sun.position
    s.position.set(x + Math.sin(drift) * SUN_DRIFT.x, y + Math.sin(drift * 0.73) * SUN_DRIFT.y, z)
    beam.origin.copy(s.position)
    beam.axis.copy(s.target.position).sub(s.position).normalize()
  })

  return (
    <>
      <hemisphereLight ref={sky} />
      <spotLight
        ref={sun}
        angle={SUN_ANGLE}
        penumbra={0.1}
        decay={0}
        map={gobo}
        castShadow // the window cookie only works on a shadow-casting light
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-camera-near={3}
        shadow-camera-far={22}
      />
      <spotLight
        ref={lamp}
        position={LAMP.position}
        color={LAMP.color}
        intensity={0}
        angle={LAMP.angle}
        penumbra={0.75}
        decay={0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-near={2}
        shadow-camera-far={16}
      />
      {/* warm rim from behind lifts the cloth edges off the wall */}
      <directionalLight ref={rim} position={[0.6, 3.2, -4]} />
      <SunCatcher {...wall} uniforms={wallUniforms} />
      {!reducedMotion && <Motes stage={stage} motion={motion} beam={beam} />}
    </>
  )
}

/**
 * The back wall, catching the light. Transparent everywhere except where direct
 * light lands, which it paints over the HTML wall behind; so the window patch,
 * its glazing bars and the cloths' shadows all come from the one light.
 */
function SunCatcher({ y, z, height, uniforms }: { y: number; z: number; height: number; uniforms: WallUniforms }) {
  const material = useMemo(() => {
    const m = new MeshLambertMaterial({ transparent: true, depthWrite: false, toneMapped: false, premultipliedAlpha: true })
    const [fadeFrom, fadeTo] = WALL_SUN_TOP.map((worldY) => (worldY - y).toFixed(3))
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;\nuniform vec3 uWallTint;\nuniform float uWallStrength;')
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          // only direct light counts: the sky fill would wash the whole wall
          float direct = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
          float glow = clamp(direct * uWallStrength, 0.0, 0.6) * (1.0 - smoothstep(${fadeFrom}, ${fadeTo}, vLocalY));
          gl_FragColor = vec4(uWallTint, glow);`,
        )
    }
    return m
  }, [y, uniforms])
  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh position={[0, y, z]} material={material} receiveShadow renderOrder={-2}>
      <planeGeometry args={[18, height]} />
    </mesh>
  )
}

// Dust turning in the sunbeam. Only motes inside the beam are lit.
const MOTE_COUNT = 260
const MOTE_BOX = { x: [-2.8, 2.8], y: [-1.2, 1.5], z: [0.1, 2.6] } as const
const MOTE_STIR = { radius: 0.35, push: 0.9, settle: 1.6 }
const BEAM_EDGE = Math.cos(WINDOW_ANGLE)
const BEAM_CORE = Math.cos(WINDOW_ANGLE * 0.7)

function softDot(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('RoomLight: 2D canvas unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

const wrap = (v: number, [lo, hi]: readonly [number, number]): number => (v < lo ? v + (hi - lo) : v > hi ? v - (hi - lo) : v)

function Motes({ stage, motion, beam }: { stage: Stage; motion: Motion; beam: Beam }) {
  const parts = useMemo(() => {
    const random = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
    const position = new Float32Array(MOTE_COUNT * 3)
    for (let i = 0; i < MOTE_COUNT; i++) {
      position[i * 3] = random(...MOTE_BOX.x)
      position[i * 3 + 1] = random(...MOTE_BOX.y)
      position[i * 3 + 2] = random(...MOTE_BOX.z)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(MOTE_COUNT * 4), 4))
    const map = softDot()
    const material = new PointsMaterial({
      size: 0.026,
      map,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    return {
      geometry,
      material,
      map,
      phase: Float32Array.from({ length: MOTE_COUNT }, () => random(0, Math.PI * 2)),
      pace: Float32Array.from({ length: MOTE_COUNT }, () => random(0.6, 1.4)),
      stir: new Float32Array(MOTE_COUNT * 3),
    }
  }, [])
  useEffect(
    () => () => {
      parts.geometry.dispose()
      parts.material.dispose()
      parts.map.dispose()
    },
    [parts],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const t = clock.elapsedTime
    const pos = parts.geometry.attributes.position.array as Float32Array
    const color = parts.geometry.attributes.color.array as Float32Array
    const { stir, phase, pace } = parts
    const { rayOrigin: o, rayDir: d } = stage
    const { origin: sun, axis, strength } = beam
    const keep = Math.exp(-MOTE_STIR.settle * dt)
    for (let i = 0; i < MOTE_COUNT; i++) {
      const p = i * 3
      let x = pos[p]
      let y = pos[p + 1]
      let z = pos[p + 2]
      // a hand moving through the beam stirs the dust aside
      if (motion.inside) {
        const rx = x - o.x
        const ry = y - o.y
        const rz = z - o.z
        const along = rx * d.x + ry * d.y + rz * d.z
        const qx = rx - d.x * along
        const qy = ry - d.y * along
        const qz = rz - d.z * along
        const dist = Math.hypot(qx, qy, qz)
        if (dist < MOTE_STIR.radius && dist > 1e-4) {
          const f = ((1 - dist / MOTE_STIR.radius) * MOTE_STIR.push * dt) / dist
          stir[p] += qx * f
          stir[p + 1] += qy * f
          stir[p + 2] += qz * f
        }
      }
      stir[p] *= keep
      stir[p + 1] *= keep
      stir[p + 2] *= keep
      const k = phase[i]
      const s = pace[i]
      x = wrap(x + (Math.sin(t * 0.31 * s + k) * 0.012 + stir[p]) * dt, MOTE_BOX.x)
      y = wrap(y + (-0.006 + Math.cos(t * 0.23 * s + k) * 0.009 + stir[p + 1]) * dt, MOTE_BOX.y)
      z = wrap(z + (Math.sin(t * 0.17 * s + k * 2) * 0.01 + stir[p + 2]) * dt, MOTE_BOX.z)
      pos[p] = x
      pos[p + 1] = y
      pos[p + 2] = z

      // lit only inside the beam, and glinting as each mote turns
      const bx = x - sun.x
      const by = y - sun.y
      const bz = z - sun.z
      const cos = (bx * axis.x + by * axis.y + bz * axis.z) / Math.hypot(bx, by, bz)
      const inBeam = Math.min(1, Math.max(0, (cos - BEAM_EDGE) / (BEAM_CORE - BEAM_EDGE)))
      const glint = 0.55 + 0.45 * Math.sin(t * 1.7 * s + k * 3)
      const c = i * 4
      color[c] = 1
      color[c + 1] = 0.9
      color[c + 2] = 0.74
      color[c + 3] = inBeam * glint * strength
    }
    parts.geometry.attributes.position.needsUpdate = true
    parts.geometry.attributes.color.needsUpdate = true
  })

  return <points geometry={parts.geometry} material={parts.material} frustumCulled={false} renderOrder={5} />
}
