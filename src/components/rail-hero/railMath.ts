/** Mutable rail/pointer state shared between the DOM handlers and the 3D frame loop. */
export interface Motion {
  /** Rail position in items; an integer means that cloth hangs in the centre. */
  offset: number
  dragging: boolean
  wheeling: boolean
  /** Pointer is over the 3D stage (not over overlay UI). */
  inside: boolean
  /** Pixels travelled since the last pointerdown, to tell clicks from drags. */
  moved: number
}

/** Where the pick glass looks on the lifted cloth, in texture UV (v = 1 at the top). */
export interface LoupePoint {
  u: number
  v: number
}

export const RAIL_RADIUS = 3.4
export const SLOT_ANGLE = 0.235 // radians between neighbouring hangers
export const RAIL_Y = 0.6
const MAX_FLING = 2 // a hard flick moves at most this many cloths

export const mod = (n: number, m: number): number => ((n % m) + m) % m

/** Signed slot of cloth `index` relative to the centre, wrapped into [-count/2, count/2). */
export function wrapSlot(index: number, offset: number, count: number): number {
  return mod(index - offset + count / 2, count) - count / 2
}

/** Shortest signed step from slot `from` to slot `to` around a ring of `count`. */
export function ringDelta(from: number, to: number, count: number): number {
  return mod(to - from + count / 2, count) - count / 2
}

/** Hangers fade out as they slide past the ends of the rail, and back in on the other side. */
export function edgeOpacity(slot: number, count: number): number {
  const start = (count - 1) / 2 + 0.05
  const end = count / 2 - 0.05
  const t = Math.min(1, Math.max(0, (Math.abs(slot) - start) / (end - start)))
  return 1 - t * t * (3 - 2 * t)
}

export interface SlotPose {
  x: number
  z: number
  angle: number
}

/** Point on the arc for a slot, and the angle the hanger faces there. */
export function slotPose(slot: number): SlotPose {
  const angle = slot * SLOT_ANGLE
  return { x: RAIL_RADIUS * Math.sin(angle), z: RAIL_RADIUS * (Math.cos(angle) - 1), angle }
}

/** Where a released drag comes to rest: the nearest cloth after a little momentum. */
export function settleTarget(offset: number, velocity: number, momentum = 0.18): number {
  const fling = Math.max(-MAX_FLING, Math.min(MAX_FLING, velocity * momentum))
  return Math.round(offset + fling)
}
