// The showroom's light across a day: 0 = morning … 1 = lamplight after dark.
// Plain numbers only, so every key can be blended into the next.

type Vec3 = readonly [number, number, number]
type Rgb = readonly [number, number, number] // sRGB 0–255
type Rgba = readonly [number, number, number, number]

export interface LightState {
  sun: { position: Vec3; target: Vec3; color: Rgb; intensity: number }
  lamp: number // ceiling lamp, for after dark
  sky: { color: Rgb; ground: Rgb; intensity: number }
  rim: { color: Rgb; intensity: number }
  environment: number
  exposure: number
  wallGlow: { tint: Rgb; strength: number }
  dust: number
  room: {
    wall: Rgb
    wallTop: Rgb
    wallBase: Rgb
    floorTop: Rgb
    floor: Rgb
    ink: Rgb
    inkSoft: Rgb
    paper: Rgb
    glass: Rgba
    inkFaint: Rgba
    shaft: Rgb
    shaftOpacity: number
    vignette: number
  }
}

export interface LightKey {
  at: number
  label: string
  light: LightState
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const DAY_ROOM = { ink: hex('#1d1915'), inkFaint: [29, 25, 21, 0.14] as Rgba }

export const LIGHT_KEYS: readonly LightKey[] = [
  {
    at: 0,
    label: 'Morning',
    light: {
      sun: { position: [-2, 4.6, 6.6], target: [-0.5, 0, 0.85], color: hex('#fff3e4'), intensity: 2.9 },
      lamp: 0,
      sky: { color: hex('#eef2f7'), ground: hex('#d2c4b0'), intensity: 1.05 },
      rim: { color: hex('#f4f6ff'), intensity: 0.7 },
      environment: 0.45,
      exposure: 1.05,
      wallGlow: { tint: hex('#fff6e8'), strength: 0.85 },
      dust: 0.5,
      room: {
        wall: hex('#e9e5de'),
        wallTop: hex('#f1eee8'),
        wallBase: hex('#ddd7cd'),
        floorTop: hex('#d9d1c4'),
        floor: hex('#cfc6b7'),
        ...DAY_ROOM,
        inkSoft: hex('#6b6560'),
        paper: hex('#f8f6f2'),
        glass: [248, 246, 242, 0.7],
        shaft: hex('#fff6e6'),
        shaftOpacity: 0.55,
        vignette: 0.11,
      },
    },
  },
  {
    at: 0.55,
    label: 'Golden hour',
    light: {
      sun: { position: [-3.2, 2.6, 7], target: [-0.65, 0.15, 0.85], color: hex('#ffdcb2'), intensity: 3.4 },
      lamp: 0,
      sky: { color: hex('#ecebe7'), ground: hex('#c6b096'), intensity: 0.85 },
      rim: { color: hex('#ffe4c2'), intensity: 1 },
      environment: 0.35,
      exposure: 1.02,
      wallGlow: { tint: hex('#ffdeb3'), strength: 1 },
      dust: 1,
      room: {
        wall: hex('#e2d9cb'),
        wallTop: hex('#e9e1d4'),
        wallBase: hex('#d6ccbc'),
        floorTop: hex('#d4c9b7'),
        floor: hex('#c9bca8'),
        ...DAY_ROOM,
        inkSoft: hex('#6b6157'),
        paper: hex('#f7f2ea'),
        glass: [247, 242, 234, 0.68],
        shaft: hex('#ffdda8'),
        shaftOpacity: 1,
        vignette: 0.18,
      },
    },
  },
  {
    at: 0.8,
    label: 'Dusk',
    light: {
      sun: { position: [-5.4, 1.4, 5.8], target: [-0.4, 0.3, 0.8], color: hex('#ffa877'), intensity: 2.7 },
      lamp: 0.6,
      sky: { color: hex('#c9c3d8'), ground: hex('#a68d7a'), intensity: 0.62 },
      rim: { color: hex('#ffc39c'), intensity: 1.15 },
      environment: 0.28,
      exposure: 1,
      wallGlow: { tint: hex('#ffbe96'), strength: 1.05 },
      dust: 0.85,
      room: {
        wall: hex('#d9cabb'),
        wallTop: hex('#e1d1c1'),
        wallBase: hex('#cbb9a7'),
        floorTop: hex('#c4b19d'),
        floor: hex('#b8a28d'),
        ink: hex('#1d1915'),
        inkFaint: [29, 25, 21, 0.16],
        inkSoft: hex('#6a5a50'),
        paper: hex('#f5eee6'),
        glass: [245, 236, 226, 0.66],
        shaft: hex('#ffbf94'),
        shaftOpacity: 0.85,
        vignette: 0.23,
      },
    },
  },
  {
    at: 1,
    label: 'Lamplight',
    light: {
      sun: { position: [-6, 0.6, 5], target: [-0.4, 0.3, 0.8], color: hex('#ff9a66'), intensity: 0 },
      lamp: 4.6,
      sky: { color: hex('#6a6577'), ground: hex('#3a2f27'), intensity: 0.34 },
      rim: { color: hex('#ffd7a6'), intensity: 0.55 },
      environment: 0.2,
      exposure: 1,
      wallGlow: { tint: hex('#ffc88c'), strength: 0.7 },
      dust: 0,
      room: {
        wall: hex('#2f2a26'),
        wallTop: hex('#37312c'),
        wallBase: hex('#26221f'),
        floorTop: hex('#2c2621'),
        floor: hex('#231e1a'),
        ink: hex('#efe7da'),
        inkFaint: [239, 231, 218, 0.18],
        inkSoft: hex('#b3a796'),
        paper: hex('#1c1814'),
        glass: [36, 31, 27, 0.62],
        shaft: hex('#ffcf99'),
        shaftOpacity: 0,
        vignette: 0.28,
      },
    },
  },
]

type Blendable = number | readonly Blendable[] | { readonly [key: string]: Blendable }

function blend<T extends Blendable>(a: T, b: T, t: number): T {
  if (typeof a === 'number') return (a + ((b as number) - a) * t) as T
  if (Array.isArray(a)) return a.map((v, i) => blend(v, (b as readonly Blendable[])[i], t)) as unknown as T
  const out: Record<string, Blendable> = {}
  for (const key of Object.keys(a)) out[key] = blend((a as Record<string, Blendable>)[key], (b as Record<string, Blendable>)[key], t)
  return out as T
}

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

/** The light at any point of the day, blended between the two nearest keys. */
export function sampleLight(t: number): LightState {
  const at = clamp01(t)
  const next = LIGHT_KEYS.findIndex((key) => key.at >= at)
  if (next <= 0) return LIGHT_KEYS[0].light
  const a = LIGHT_KEYS[next - 1]
  const b = LIGHT_KEYS[next]
  return blend(a.light as unknown as Blendable, b.light as unknown as Blendable, (at - a.at) / (b.at - a.at)) as unknown as LightState
}

/** Name of the key closest to `t`, for the dial's caption. */
export function lightLabel(t: number): string {
  return LIGHT_KEYS.reduce((best, key) => (Math.abs(key.at - t) < Math.abs(best.at - t) ? key : best)).label
}

// Visitor's clock → light: night until six, morning light, then the long slide to golden hour and dusk.
const CLOCK: readonly (readonly [number, number])[] = [
  [0, 1],
  [6, 1],
  [6.01, 0],
  [11, 0.25],
  [16.5, 0.55],
  [18.5, 0.8],
  [20, 1],
  [24, 1],
]

export function timeOfDay(date: Date): number {
  const hour = date.getHours() + date.getMinutes() / 60
  const next = CLOCK.findIndex(([h]) => h >= hour)
  if (next <= 0) return CLOCK[0][1]
  const [h0, t0] = CLOCK[next - 1]
  const [h1, t1] = CLOCK[next]
  return t0 + ((t1 - t0) * (hour - h0)) / (h1 - h0)
}

const css = ([r, g, b]: Rgb): string => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`
const cssA = ([r, g, b, a]: Rgba): string => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${a.toFixed(3)})`

/** The room's CSS custom properties for a light state. */
export function roomVars({ room }: LightState): Record<string, string> {
  return {
    '--color-wall': css(room.wall),
    '--color-wall-top': css(room.wallTop),
    '--color-wall-base': css(room.wallBase),
    '--color-floor-top': css(room.floorTop),
    '--color-floor': css(room.floor),
    '--color-ink': css(room.ink),
    '--color-ink-soft': css(room.inkSoft),
    '--color-ink-faint': cssA(room.inkFaint),
    '--color-paper': css(room.paper),
    '--color-glass': cssA(room.glass),
    '--shaft-color': css(room.shaft),
    '--shaft-opacity': room.shaftOpacity.toFixed(3),
    '--vignette': `${Math.round(room.vignette * 100)}%`,
  }
}
