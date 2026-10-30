import { describe, expect, it } from 'vitest'
import { ClothSim, drapeFor, type ClothForces, type RayForce } from './cloth'

const COLS = 9
const ROWS = 17
const WIDTH = 0.6
const HEIGHT = 1.2
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const CALM: ClothForces = { gravity: 9.8, time: 0, wind: { x: 0, y: 0, z: 1, strength: 0 }, ray: null }

function hangingCloth(inertia = 1) {
  const pos = new Float32Array(COLS * ROWS * 3)
  const pinned = [1, COLS - 2]
  const sim = new ClothSim(pos, { cols: COLS, rows: ROWS, width: WIDTH, height: HEIGHT, pinned, bend: 0.3, drag: 1.5, inertia })
  const pins = new Float32Array(pinned.flatMap((c) => [sim.restX(c), 0, 0]))
  sim.reset(IDENTITY, 0, 1, pins)
  return { sim, pos, pins, pinned }
}

const particle = (row: number, col: number) => (row * COLS + col) * 3

describe('ClothSim', () => {
  it('holds its clips exactly where the hanger puts them', () => {
    const { sim, pos, pins, pinned } = hangingCloth()
    pins[0] += 0.05 // the hanger swings sideways

    for (let frame = 0; frame < 30; frame++) sim.step(1 / 60, pins, CALM)

    pinned.forEach((p, k) => {
      for (let axis = 0; axis < 3; axis++) expect(pos[p * 3 + axis]).toBeCloseTo(pins[k * 3 + axis], 5)
    })
  })

  it('hangs to its full length without stretching', () => {
    const { sim, pos, pins } = hangingCloth()

    for (let frame = 0; frame < 240; frame++) sim.step(1 / 60, pins, CALM)

    const hem = pos[particle(ROWS - 1, Math.floor(COLS / 2)) + 1]
    expect(hem).toBeLessThan(-HEIGHT * 0.9)
    expect(hem).toBeGreaterThan(-HEIGHT * 1.03)
  })

  it('gives way where the pointer presses and stays finite', () => {
    const { sim, pos, pins } = hangingCloth()
    const ray: RayForce = { ox: 0, oy: -0.6, oz: 5, dx: 0, dy: 0, dz: -1, vx: 3, vy: 0, vz: 0, radius: 0.2, push: 40, carry: 8 }

    for (let frame = 0; frame < 120; frame++) sim.step(1 / 60, pins, { ...CALM, ray })

    expect(pos.every(Number.isFinite)).toBe(true)
    expect(pos[particle(Math.floor(ROWS / 2), Math.floor(COLS / 2)) + 2]).toBeLessThan(-0.01)
  })

  it('never flips over its clips when the hanger is carried off quickly', () => {
    const { sim, pos, pins } = hangingCloth(0.75)
    const start = Float32Array.from(pins)
    let highest = -Infinity
    for (let frame = 1; frame <= 75; frame++) {
      const t = Math.min(1, frame / 60)
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * t) // the lift's sine ease
      for (let k = 0; k < pins.length / 3; k++) {
        pins[k * 3 + 1] = start[k * 3 + 1] + 0.1 * eased
        pins[k * 3 + 2] = start[k * 3 + 2] + 2 * eased // two metres toward the viewer
      }
      sim.step(1 / 60, pins, CALM)
      for (let i = 1; i < pos.length; i += 3) highest = Math.max(highest, pos[i] - pins[1])
    }
    expect(highest).toBeLessThan(0.02)
  })

  it('rejects a buffer that does not match its grid', () => {
    expect(
      () => new ClothSim(new Float32Array(10), { cols: COLS, rows: ROWS, width: 1, height: 1, pinned: [0], bend: 0.3, drag: 1, inertia: 1 }),
    ).toThrow(/expected/)
  })
})

describe('drapeFor', () => {
  it('makes heavier cloth stiffer, calmer and less airborne', () => {
    const silk = drapeFor(90)
    const coating = drapeFor(330)
    expect(coating.bend).toBeGreaterThan(silk.bend)
    expect(coating.lift).toBeLessThan(silk.lift)
    expect(coating.drag).toBeLessThan(silk.drag)
  })
})
