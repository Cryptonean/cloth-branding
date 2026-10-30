import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, type Texture } from 'three'
import type { Weave } from '../../data/cloths'

// A tiling relief of the weave, so light catches the threads as the cloth folds.
// Generated rather than shipped: real photo scans keep working with it.
const THREADS = 20 // divisible by 4 (twill) and 5 (satin) so the tile repeats cleanly
const PX = 6
const SIZE = THREADS * PX
const SLOPE = 2.4

export const WEAVE_STRENGTH: Record<Weave, number> = {
  brushed: 0.22,
  twill: 0.55,
  herringbone: 0.6,
  plain: 0.5,
  satin: 0.28,
}

function warpOnTop(weave: Weave, i: number, j: number): boolean {
  if (weave === 'plain') return ((i + j) & 1) === 0
  if (weave === 'herringbone') return Math.floor(i / 5) % 2 ? (i + j) % 4 < 2 : (i - j + 40) % 4 < 2
  if (weave === 'satin') return (i * 2 + j) % 5 !== 0
  return (i + j) % 4 < 2 // twill, and the broken twill under a brushed face
}

function height(weave: Weave, x: number, y: number): number {
  const wx = (x + SIZE) % SIZE
  const wy = (y + SIZE) % SIZE
  if (weave === 'brushed') return 0.5 + 0.1 * Math.sin(wx * 0.31 + Math.sin(wy * 0.17) * 2.4)
  const i = Math.floor(wx / PX)
  const j = Math.floor(wy / PX)
  const top = warpOnTop(weave, i, j)
  const across = ((top ? wx : wy) % PX) / PX
  const along = ((top ? wy : wx) % PX) / PX
  return Math.sin(Math.PI * across) * (1 - 0.5 * (2 * along - 1) ** 2)
}

export function weaveNormalMap(weave: Weave): Texture {
  const data = new Uint8Array(SIZE * SIZE * 4)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (height(weave, x + 1, y) - height(weave, x - 1, y)) * SLOPE
      const dy = (height(weave, x, y + 1) - height(weave, x, y - 1)) * SLOPE
      const len = Math.hypot(dx, dy, 1)
      const o = (y * SIZE + x) * 4
      data[o] = (-dx / len) * 127.5 + 127.5
      data[o + 1] = (-dy / len) * 127.5 + 127.5
      data[o + 2] = (1 / len) * 127.5 + 127.5
      data[o + 3] = 255
    }
  }
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(20, 40)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}
