/**
 * Position-based (Verlet) cloth: a grid of particles hanging from a few pinned
 * points. It writes straight into a PlaneGeometry's position buffer, in world space.
 */

export interface ClothConfig {
  cols: number // particles across
  rows: number // particles down
  width: number
  height: number
  /** Top-row columns held by the hanger's clips. */
  pinned: number[]
  bend: number // 0..1 stiffness of the skip-one links
  drag: number // air drag, 1/s
  /** Share of the hanger's travel the cloth resists (1 = full world-space inertia). */
  inertia: number
}

/** A finger pushing along a ray: the pointer ray from the camera into the scene. */
export interface RayForce {
  ox: number
  oy: number
  oz: number
  dx: number
  dy: number
  dz: number
  vx: number // pointer velocity where it crosses the cloth, m/s
  vy: number
  vz: number
  radius: number
  push: number // acceleration along the ray, m/s²
  carry: number // how strongly the cloth follows pointer motion, 1/s
}

export interface ClothForces {
  gravity: number
  time: number
  wind: { x: number; y: number; z: number; strength: number }
  ray: RayForce | null
}

export interface Drape {
  bend: number
  drag: number
  lift: number
  swingDamp: number
}

/** Heavier cloth is stiffer, loses less to the air and answers the hand more slowly. */
export function drapeFor(gsm: number): Drape {
  const t = Math.min(1, Math.max(0, (gsm - 80) / 260))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return { bend: lerp(0.08, 0.55), drag: lerp(2.6, 0.8), lift: lerp(1.5, 0.8), swingDamp: lerp(3.2, 1.6) }
}

const MAX_STEP = 1 / 120
const ITERATIONS = 6
const SHEAR = 0.9
const TETHER_SLACK = 1.01

export class ClothSim {
  readonly pos: Float32Array
  private readonly prev: Float32Array
  private readonly free: Float32Array // 1 = simulated, 0 = pinned
  private readonly pins: Int32Array
  private readonly pinFrom: Float32Array
  private readonly links: Int32Array
  private readonly lengths: Float32Array
  private readonly stiffness: Float32Array
  private readonly tetherPin: Int32Array
  private readonly tetherLength: Float32Array
  private readonly config: ClothConfig
  private lastStep = MAX_STEP

  constructor(pos: Float32Array, config: ClothConfig) {
    const { cols, rows } = config
    const count = cols * rows
    if (pos.length !== count * 3) throw new Error(`ClothSim: expected ${count * 3} floats, got ${pos.length}`)
    this.pos = pos
    this.config = config
    this.prev = new Float32Array(count * 3)
    this.free = new Float32Array(count).fill(1)
    this.pins = Int32Array.from(config.pinned)
    for (const p of this.pins) this.free[p] = 0
    this.pinFrom = new Float32Array(this.pins.length * 3)

    const rest = (i: number): [number, number] => [this.restX(i % cols), this.restY(Math.floor(i / cols))]
    const links: number[] = []
    const lengths: number[] = []
    const stiffness: number[] = []
    const link = (a: number, b: number, k: number) => {
      const [ax, ay] = rest(a)
      const [bx, by] = rest(b)
      links.push(a, b)
      lengths.push(Math.hypot(bx - ax, by - ay))
      stiffness.push(k)
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        if (c + 1 < cols) link(i, i + 1, 1)
        if (r + 1 < rows) link(i, i + cols, 1)
        if (c + 1 < cols && r + 1 < rows) {
          link(i, i + cols + 1, SHEAR)
          link(i + 1, i + cols, SHEAR)
        }
        if (c + 2 < cols) link(i, i + 2, config.bend)
        if (r + 2 < rows) link(i, i + cols * 2, config.bend)
      }
    }
    this.links = Int32Array.from(links)
    this.lengths = Float32Array.from(lengths)
    this.stiffness = Float32Array.from(stiffness)

    // Long-range tethers: no particle may drift further from its nearest pin
    // than it is at rest. This removes the rubbery stretch of plain Verlet.
    this.tetherPin = new Int32Array(count)
    this.tetherLength = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const [x, y] = rest(i)
      let best = Infinity
      this.pins.forEach((p, k) => {
        const [px, py] = rest(p)
        const d = Math.hypot(x - px, y - py)
        if (d < best) {
          best = d
          this.tetherPin[i] = k
        }
      })
      this.tetherLength[i] = best * TETHER_SLACK
    }
  }

  restX(col: number): number {
    return (col / (this.config.cols - 1) - 0.5) * this.config.width
  }

  restY(row: number): number {
    return (-row / (this.config.rows - 1)) * this.config.height
  }

  /**
   * Hang the cloth at rest under `matrix` (column-major 4×4, hanger to world),
   * with its top edge at `topY` and gathered to `gather` of its width, then
   * let it settle for `settleSteps` at the given pins.
   */
  reset(matrix: ArrayLike<number>, topY: number, gather: number, pins: Float32Array, settleSteps = 0): void {
    const { cols, rows } = this.config
    const m = matrix
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = this.restX(c) * gather
        const y = this.restY(r) + topY
        // a whisper of depth so the gathered cloth buckles into folds, not flat
        const z = 0.012 * Math.sin(c * 1.9) * (1 - (0.5 * r) / rows)
        const o = (r * cols + c) * 3
        this.pos[o] = m[0] * x + m[4] * y + m[8] * z + m[12]
        this.pos[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
        this.pos[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
      }
    }
    this.prev.set(this.pos)
    this.pinFrom.set(pins)
    this.lastStep = MAX_STEP
    const still: ClothForces = { gravity: 9.8, time: 0, wind: { x: 0, y: 0, z: 0, strength: 0 }, ray: null }
    for (let s = 0; s < settleSteps; s++) this.step(MAX_STEP, pins, still)
  }

  /** Advance by `dt` seconds. `pins` holds the clip positions now (xyz per pin). */
  step(dt: number, pins: Float32Array, forces: ClothForces): void {
    if (!(dt > 0)) return
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-6))
    const h = dt / steps
    for (let s = 1; s <= steps; s++) {
      this.carry(pins, 1 / steps)
      this.integrate(h, forces)
      this.placePins(pins, s / steps)
      for (let k = 0; k < ITERATIONS; k++) this.solve()
      this.tether()
    }
    this.pinFrom.set(pins)
  }

  /** Move the free cloth along with part of the hanger's travel, without giving it velocity. */
  private carry(pins: Float32Array, share: number) {
    const amount = (1 - this.config.inertia) * share
    if (amount <= 0) return
    const n = this.pins.length
    let dx = 0
    let dy = 0
    let dz = 0
    for (let k = 0; k < n; k++) {
      dx += pins[k * 3] - this.pinFrom[k * 3]
      dy += pins[k * 3 + 1] - this.pinFrom[k * 3 + 1]
      dz += pins[k * 3 + 2] - this.pinFrom[k * 3 + 2]
    }
    dx *= amount / n
    dy *= amount / n
    dz *= amount / n
    const { pos, prev, free } = this
    for (let i = 0, count = free.length; i < count; i++) {
      if (!free[i]) continue
      const o = i * 3
      pos[o] += dx
      pos[o + 1] += dy
      pos[o + 2] += dz
      prev[o] += dx
      prev[o + 1] += dy
      prev[o + 2] += dz
    }
  }

  private placePins(pins: Float32Array, t: number) {
    for (let k = 0; k < this.pins.length; k++) {
      const o = this.pins[k] * 3
      for (let a = 0; a < 3; a++) {
        const v = this.pinFrom[k * 3 + a] + (pins[k * 3 + a] - this.pinFrom[k * 3 + a]) * t
        this.pos[o + a] = v
        this.prev[o + a] = v
      }
    }
  }

  private integrate(h: number, { gravity, time, wind, ray }: ClothForces) {
    const { pos, prev, free } = this
    // time-corrected Verlet keeps velocity right when the step size changes
    const keep = Math.exp(-this.config.drag * h) * (h / this.lastStep)
    this.lastStep = h
    const h2 = h * h
    const r2 = ray ? ray.radius * ray.radius : 0
    for (let i = 0, n = free.length; i < n; i++) {
      if (!free[i]) continue
      const o = i * 3
      const x = pos[o]
      const y = pos[o + 1]
      const z = pos[o + 2]
      let ax = 0
      let ay = -gravity
      let az = 0
      if (wind.strength) {
        const w = wind.strength * (0.55 * Math.sin(time * 1.1 + x * 2.1 + y * 3.3) + 0.45 * Math.sin(time * 0.53 + y * 1.7 - x * 1.3))
        ax += wind.x * w
        ay += wind.y * w
        az += wind.z * w
      }
      if (ray) {
        const rx = x - ray.ox
        const ry = y - ray.oy
        const rz = z - ray.oz
        const along = rx * ray.dx + ry * ray.dy + rz * ray.dz
        if (along > 0) {
          const qx = rx - ray.dx * along
          const qy = ry - ray.dy * along
          const qz = rz - ray.dz * along
          const d2 = qx * qx + qy * qy + qz * qz
          if (d2 < r2) {
            let f = 1 - Math.sqrt(d2) / ray.radius
            f *= f
            ax += (ray.dx * ray.push + ray.vx * ray.carry) * f
            ay += (ray.dy * ray.push + ray.vy * ray.carry) * f
            az += (ray.dz * ray.push + ray.vz * ray.carry) * f
          }
        }
      }
      pos[o] = x + (x - prev[o]) * keep + ax * h2
      pos[o + 1] = y + (y - prev[o + 1]) * keep + ay * h2
      pos[o + 2] = z + (z - prev[o + 2]) * keep + az * h2
      prev[o] = x
      prev[o + 1] = y
      prev[o + 2] = z
    }
  }

  private solve() {
    const { pos, free, links, lengths, stiffness } = this
    for (let k = 0, n = lengths.length; k < n; k++) {
      const a = links[k * 2]
      const b = links[k * 2 + 1]
      const wa = free[a]
      const wb = free[b]
      const w = wa + wb
      if (!w) continue
      const oa = a * 3
      const ob = b * 3
      const dx = pos[ob] - pos[oa]
      const dy = pos[ob + 1] - pos[oa + 1]
      const dz = pos[ob + 2] - pos[oa + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < 1e-9) continue
      const s = (((d - lengths[k]) / d) * stiffness[k]) / w
      pos[oa] += dx * s * wa
      pos[oa + 1] += dy * s * wa
      pos[oa + 2] += dz * s * wa
      pos[ob] -= dx * s * wb
      pos[ob + 1] -= dy * s * wb
      pos[ob + 2] -= dz * s * wb
    }
  }

  private tether() {
    const { pos, free, pins, tetherPin, tetherLength } = this
    for (let i = 0, n = free.length; i < n; i++) {
      if (!free[i]) continue
      const o = i * 3
      const p = pins[tetherPin[i]] * 3
      const dx = pos[o] - pos[p]
      const dy = pos[o + 1] - pos[p + 1]
      const dz = pos[o + 2] - pos[p + 2]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const max = tetherLength[i]
      if (d <= max) continue
      const s = max / d
      pos[o] = pos[p] + dx * s
      pos[o + 1] = pos[p + 1] + dy * s
      pos[o + 2] = pos[p + 2] + dz * s
    }
  }
}
