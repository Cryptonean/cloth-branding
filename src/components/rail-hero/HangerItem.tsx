import { useFrame, useLoader, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Cloth } from '../../data/cloths'
import { ClothSim, drapeFor, type ClothForces, type RayForce } from './cloth'
import type { Stage } from './RailScene'
import { edgeOpacity, mod, RAIL_Y, slotPose, wrapSlot, type LoupePoint, type Motion } from './railMath'
import { WEAVE_STRENGTH, weaveNormalMap } from './weaveNormal'

// A cut length of cloth: 62 × 125 cm, held by two clips on a walnut bar.
const CLOTH_W = 0.62
const CLOTH_H = 1.25
const COLS = 17
const ROWS = 33
const GATHER = 0.93 // clips sit a touch closer than the cloth is wide, so it drapes
const PINNED = [1, 2, COLS - 3, COLS - 2]
const BAR_Y = -0.11
const CLIP_Y = BAR_Y - 0.035
const CLOTH_TOP = -0.158 // where the cloth leaves the clips
const SETTLE_STEPS = 90

const LIFT_ARC = 0.14 // lifts up off the rail before it comes forward
const LIFT_SECONDS = 1.25 // unhurried: a cloth this rare is handled slowly
const INERTIA = 0.75 // the cloth trails three quarters of the hanger's travel
const DIM_AMOUNT = 0.8
const GRAVITY = 9.8
const PENDULUM = 0.42 // effective length of hanger + cloth, m
const MAX_SWING = 0.5
const ACC_SMOOTHING = 12
const SWING_COUPLING = 0.55 // the hook drags on the rail, so it takes only part of the jolt
const HAND_STEADY = 4 // a hand holds the hanger still while it is being carried
const WIND = 0.5
const POINTER = { radius: 0.2, push: 6, pushPerSpeed: 10, carry: 9, maxSpeed: 6 }
const CLICK_SLOP = 6 // px a press may travel and still count as a click
const MIN_HIT_OPACITY = 0.3

const PINCH = 0.012 // each clip bunches a little cloth into its jaws, which throws soft folds

const colX = (col: number): number => (col / (COLS - 1) - 0.5) * CLOTH_W
const CLIP_X = [((colX(1) + colX(2)) / 2) * GATHER, ((colX(COLS - 3) + colX(COLS - 2)) / 2) * GATHER]
// PINNED holds two columns per clip: left of the jaws, then right
const PIN_LOCAL = PINNED.map((_, k) => new Vector3(CLIP_X[k >> 1] + (k % 2 ? PINCH : -PINCH) / 2, CLOTH_TOP, 0))

const hookGeometry = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0, -0.1, 0),
    new Vector3(0, -0.06, 0),
    new Vector3(0, -0.036, 0.002),
    new Vector3(0, -0.022, 0.015),
    new Vector3(0, 0.001, 0.021),
    new Vector3(0, 0.015, 0.008),
    new Vector3(0, 0.012, -0.01),
    new Vector3(0, -0.004, -0.02),
    new Vector3(0, -0.021, -0.017),
  ]),
  64,
  0.0026,
  8,
  false,
)
const barGeometry = new RoundedBoxGeometry(0.58, 0.024, 0.016, 2, 0.007)
const clipGeometry = new RoundedBoxGeometry(0.036, 0.046, 0.019, 2, 0.004)

export interface HangerItemProps {
  cloth: Cloth
  index: number
  count: number
  target: number
  focused: boolean
  motion: Motion
  stage: Stage
  reducedMotion: boolean
  loupe: LoupePoint
  onSelect: (index: number) => void
  onHover: (index: number | null) => void
}

interface Live {
  primed: boolean
  prevSlot: number
  lift: number
  dim: number
  opacity: number
  swingX: number
  swingZ: number
  spinX: number
  spinZ: number
  pivot: Vector3
  prevPivot: Vector3
  vel: Vector3
  prevVel: Vector3
  acc: Vector3
  tmp: Vector3
  hit: Vector3
  prevHit: Vector3
  hitVel: Vector3
  hasHit: boolean
  pins: Float32Array
  forces: ClothForces
  ray: RayForce
}

// sine easing: no jolt at either end, so the cloth is never whipped
const easeInOutSine = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * t)
const moveToward = (from: number, to: number, maxStep: number): number =>
  from < to ? Math.min(to, from + maxStep) : Math.max(to, from - maxStep)

export function HangerItem({
  cloth,
  index,
  count,
  target,
  focused,
  motion,
  stage,
  reducedMotion,
  loupe,
  onSelect,
  onHover,
}: HangerItemProps) {
  const hanger = useRef<Group>(null)
  const clothMesh = useRef<Mesh>(null)
  const texture = useLoader(TextureLoader, cloth.images.texture)
  const drape = useMemo(() => drapeFor(cloth.gsm), [cloth.gsm])
  const geometry = useMemo(() => new PlaneGeometry(CLOTH_W, CLOTH_H, COLS - 1, ROWS - 1), [])
  const sim = useMemo(
    () =>
      new ClothSim(geometry.attributes.position.array as Float32Array, {
        cols: COLS,
        rows: ROWS,
        width: CLOTH_W,
        height: CLOTH_H,
        pinned: PINNED,
        bend: drape.bend,
        drag: drape.drag,
        inertia: INERTIA,
      }),
    [geometry, drape],
  )
  const materials = useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    const weave = WEAVE_STRENGTH[cloth.weave]
    return {
      cloth: new MeshPhysicalMaterial({
        map: texture,
        normalMap: weaveNormalMap(cloth.weave),
        normalScale: new Vector2(weave, weave),
        roughness: cloth.finish.roughness,
        sheen: cloth.finish.sheen,
        sheenRoughness: 0.5,
        sheenColor: new Color('#f6e7cc'),
        anisotropy: cloth.finish.anisotropy ?? 0,
        anisotropyRotation: Math.PI / 2, // highlights run along the warp
        side: DoubleSide,
        transparent: true,
      }),
      brass: new MeshStandardMaterial({ color: '#c2a06a', metalness: 1, roughness: 0.28, transparent: true }),
      walnut: new MeshStandardMaterial({ color: '#4b2f1f', roughness: 0.5, transparent: true }),
    }
  }, [texture, cloth])
  useEffect(
    () => () => {
      materials.cloth.normalMap?.dispose()
      Object.values(materials).forEach((m) => m.dispose())
      geometry.dispose()
    },
    [materials, geometry],
  )

  const live = useMemo<Live>(
    () => ({
      primed: false,
      prevSlot: 0,
      lift: 0,
      dim: 0,
      opacity: 1,
      swingX: 0,
      swingZ: 0,
      spinX: 0,
      spinZ: 0,
      pivot: new Vector3(),
      prevPivot: new Vector3(),
      vel: new Vector3(),
      prevVel: new Vector3(),
      acc: new Vector3(),
      tmp: new Vector3(),
      hit: new Vector3(),
      prevHit: new Vector3(),
      hitVel: new Vector3(),
      hasHit: false,
      pins: new Float32Array(PINNED.length * 3),
      forces: { gravity: GRAVITY, time: 0, wind: { x: 0, y: 0, z: 1, strength: 0 }, ray: null },
      ray: { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1, vx: 0, vy: 0, vz: 0, radius: POINTER.radius, push: 0, carry: 0 },
    }),
    [],
  )

  useFrame((state, rawDt) => {
    const group = hanger.current
    const dt = Math.min(rawDt, 1 / 30)
    if (!group || dt <= 0) return

    const slot = wrapSlot(index, motion.offset, count)
    const wrapped = live.primed && Math.abs(slot - live.prevSlot) > count / 2
    live.prevSlot = slot
    const isActive = focused && mod(target, count) === index
    const yaw = placePivot(live, slot, isActive, focused, stage, dt, reducedMotion)
    if (!live.primed || wrapped) {
      live.prevPivot.copy(live.pivot)
      live.vel.set(0, 0, 0)
      live.acc.set(0, 0, 0)
    }
    swing(live, yaw, dt, drape.swingDamp * (1 + HAND_STEADY * Math.sin(Math.PI * live.lift)))

    group.position.copy(live.pivot)
    group.rotation.set(live.swingX, yaw, live.swingZ, 'YXZ')
    group.updateMatrixWorld()
    PIN_LOCAL.forEach((pin, k) => {
      live.tmp.copy(pin).applyMatrix4(group.matrixWorld)
      live.tmp.toArray(live.pins, k * 3)
    })
    if (!live.primed || wrapped) {
      // the cloth jumped ends of the rail while invisible: hang it fresh
      sim.reset(group.matrixWorld.elements, CLOTH_TOP, GATHER, live.pins, live.primed ? 0 : SETTLE_STEPS)
      live.primed = true
    }

    const { forces } = live
    forces.time = state.clock.elapsedTime
    forces.wind.x = Math.sin(yaw)
    forces.wind.z = Math.cos(yaw)
    forces.wind.strength = reducedMotion ? 0 : WIND * drape.lift
    forces.ray = pointerForce(live, motion.inside, stage, yaw, dt, drape.lift)
    sim.step(dt, live.pins, forces)
    geometry.attributes.position.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    live.opacity = edgeOpacity(slot, count) * (1 - DIM_AMOUNT * live.dim)
    Object.values(materials).forEach((m) => (m.opacity = live.opacity))
    const visible = live.opacity > 0.01
    group.visible = visible
    if (clothMesh.current) {
      clothMesh.current.visible = visible
      clothMesh.current.castShadow = live.opacity > 0.45 // shadows ignore opacity
    }
  }, -1)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta <= CLICK_SLOP && live.opacity > MIN_HIT_OPACITY) onSelect(index)
  }
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (live.opacity > MIN_HIT_OPACITY) onHover(index)
  }
  // the pick glass reads the weave exactly where the pointer meets the lifted cloth
  const lifted = focused && mod(target, count) === index
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!lifted || e.object !== clothMesh.current || !e.uv) return
    loupe.u = e.uv.x
    loupe.v = e.uv.y
  }

  return (
    <group onClick={handleClick} onPointerOver={handleOver} onPointerOut={() => onHover(null)} onPointerMove={handleMove}>
      <group ref={hanger}>
        <mesh geometry={hookGeometry} material={materials.brass} castShadow />
        <mesh geometry={barGeometry} material={materials.walnut} position={[0, BAR_Y, 0]} castShadow />
        {CLIP_X.map((x) => (
          <mesh key={x} geometry={clipGeometry} material={materials.brass} position={[x, CLIP_Y, 0]} castShadow />
        ))}
      </group>
      {/* simulated in world space, so it sits outside the hanger's transform */}
      <mesh
        ref={clothMesh}
        geometry={geometry}
        material={materials.cloth}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
    </group>
  )
}

/** Slot on the rail blended toward the focus position as the cloth is lifted off. Returns yaw. */
function placePivot(
  live: Live,
  slot: number,
  isActive: boolean,
  focused: boolean,
  { focusY, focusZ }: Stage,
  dt: number,
  reducedMotion: boolean,
): number {
  live.lift = moveToward(live.lift, isActive ? 1 : 0, dt / (reducedMotion ? 0.25 : LIFT_SECONDS))
  live.dim = MathUtils.damp(live.dim, focused && !isActive ? 1 : 0, 4, dt)
  const pose = slotPose(slot)
  const e = easeInOutSine(live.lift)
  live.pivot.set(
    MathUtils.lerp(pose.x, 0, e),
    MathUtils.lerp(RAIL_Y, focusY, e) + Math.sin(Math.PI * e) * LIFT_ARC,
    MathUtils.lerp(pose.z, focusZ, e),
  )
  return MathUtils.lerp(pose.angle, 0, e)
}

/** The hanger swings from its hook as the pivot accelerates, like a real pendulum. */
function swing(live: Live, yaw: number, dt: number, damping: number) {
  live.prevVel.copy(live.vel)
  live.vel.subVectors(live.pivot, live.prevPivot).divideScalar(dt)
  live.prevPivot.copy(live.pivot)
  live.tmp.subVectors(live.vel, live.prevVel).divideScalar(dt)
  live.acc.lerp(live.tmp, 1 - Math.exp(-ACC_SMOOTHING * dt))

  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const side = (live.acc.x * cos - live.acc.z * sin) * SWING_COUPLING
  const forward = (live.acc.x * sin + live.acc.z * cos) * SWING_COUPLING
  const k = GRAVITY / PENDULUM
  live.spinZ += (-k * Math.sin(live.swingZ) - (side / PENDULUM) * Math.cos(live.swingZ) - damping * live.spinZ) * dt
  live.spinX += (-k * Math.sin(live.swingX) + (forward / PENDULUM) * Math.cos(live.swingX) - damping * live.spinX) * dt
  live.swingZ = MathUtils.clamp(live.swingZ + live.spinZ * dt, -MAX_SWING, MAX_SWING)
  live.swingX = MathUtils.clamp(live.swingX + live.spinX * dt, -MAX_SWING, MAX_SWING)
}

/** The pointer acts as a soft hand: it presses into the cloth and drags it along as it moves. */
function pointerForce(live: Live, inside: boolean, stage: Stage, yaw: number, dt: number, lift: number): RayForce | null {
  if (!inside) {
    live.hasHit = false
    return null
  }
  const nx = Math.sin(yaw)
  const nz = Math.cos(yaw)
  const { rayDir: d, rayOrigin: o } = stage
  const facing = d.x * nx + d.z * nz
  if (Math.abs(facing) < 1e-3) return null

  // pointer speed measured where its ray crosses this cloth's plane
  const t = ((live.pivot.x - o.x) * nx + (live.pivot.z - o.z) * nz) / facing
  live.hit.copy(d).multiplyScalar(t).add(o)
  if (live.hasHit) {
    live.tmp.subVectors(live.hit, live.prevHit).divideScalar(dt)
    live.hitVel.lerp(live.tmp, 1 - Math.exp(-18 * dt))
  } else {
    live.hitVel.set(0, 0, 0)
  }
  live.prevHit.copy(live.hit)
  live.hasHit = true
  if (live.hitVel.length() > POINTER.maxSpeed) live.hitVel.setLength(POINTER.maxSpeed)

  const { ray } = live
  ray.ox = o.x
  ray.oy = o.y
  ray.oz = o.z
  ray.dx = d.x
  ray.dy = d.y
  ray.dz = d.z
  ray.vx = live.hitVel.x
  ray.vy = live.hitVel.y
  ray.vz = live.hitVel.z
  ray.push = (POINTER.push + POINTER.pushPerSpeed * live.hitVel.length()) * lift
  ray.carry = POINTER.carry * lift
  return ray
}
