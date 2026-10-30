// Generates placeholder assets for every cloth: a flat scan (texture), a
// thread-level close-up (macro) and the garment it is classically cut into (look).
// Real photos replace these files 1:1 in public/assets/fabrics/<id>/ — no code changes.
import { createCanvas } from '@napi-rs/canvas'
import { mkdir, writeFile } from 'node:fs/promises'

const OUT_DIR = new URL('../public/assets/fabrics/', import.meta.url)
const TEX_W = 1024
const TEX_H = 2048
const SELVEDGE_W = 38
const TAU = Math.PI * 2

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const range = (r, a, b) => a + (b - a) * r()
const rgba = ([r, g, b], a = 1, k = 1) =>
  `rgba(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0},${a})`

function layer(w, h) {
  const canvas = createCanvas(w, h)
  return [canvas, canvas.getContext('2d')]
}

function grain(ctx, w, h, r, amount) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

// Loose fibres lifting off the surface — the visible softness of fine wool.
function fibres(ctx, w, h, r, count, color, { len = [4, 16], width = [0.4, 0.9], alpha = [0.05, 0.16], vertical = 0.7 } = {}) {
  for (let i = 0; i < count; i++) {
    const x = r() * w
    const y = r() * h
    const a = Math.PI / 2 + range(r, -1, 1) * (1 - vertical) * Math.PI
    const l = range(r, len[0], len[1])
    ctx.strokeStyle = rgba(color, range(r, alpha[0], alpha[1]))
    ctx.lineWidth = range(r, width[0], width[1])
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(
      x + Math.cos(a + range(r, -0.8, 0.8)) * l * 0.6,
      y + Math.sin(a + range(r, -0.8, 0.8)) * l * 0.6,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    )
    ctx.stroke()
  }
}

/* ---------- the cloths ---------- */

const CLOTHS = [
  {
    id: 'vicuna',
    seed: 11,
    base: [38, 46, 72], // piece-dyed midnight navy
    heather: 0.08,
    weave: 'brushed',
    nap: 1,
    slub: 0,
    selvedge: { text: 'FILARE  ·  PURE VICUÑA  ·  12.5 MICRON  ·  ANDES', line: [196, 168, 110] },
    macro: { cell: 5, weave: 'twill', fuzz: 1 },
    garment: 'overcoat',
  },
  {
    id: 'cervelt',
    seed: 23,
    base: [150, 163, 140], // sage
    heather: 0.07,
    weave: 'twill',
    nap: 0.35,
    slub: 0,
    selvedge: { text: 'FILARE  ·  PURE CERVELT  ·  RED DEER DOWN  ·  NEW ZEALAND', line: [72, 84, 64] },
    macro: { cell: 6, weave: 'twill', fuzz: 0.45 },
    garment: 'jacket',
  },
  {
    id: 'qiviut',
    seed: 37,
    base: [98, 36, 44], // oxblood
    heather: 0.1,
    weave: 'herringbone',
    nap: 0.7,
    slub: 0,
    selvedge: { text: 'FILARE  ·  QIVIUT  ·  ARCTIC MUSK OX DOWN', line: [214, 186, 156] },
    macro: { cell: 6, weave: 'herringbone', fuzz: 0.8 },
    garment: 'stole',
  },
  {
    id: 'lotus',
    seed: 41,
    base: [204, 191, 162],
    heather: 0.05,
    weave: 'plain',
    nap: 0,
    slub: 1,
    selvedge: { text: 'FILARE  ·  LOTUS STEM SILK  ·  HANDWOVEN  ·  INLE LAKE', line: [150, 130, 96] },
    macro: { cell: 8, weave: 'plain', fuzz: 0 },
    garment: 'shirt',
  },
  {
    id: 'muga',
    seed: 53,
    base: [198, 156, 82],
    heather: 0.04,
    weave: 'satin',
    nap: 0,
    slub: 0.3,
    selvedge: { text: 'FILARE  ·  MUGA SILK  ·  WILD GOLDEN SILK  ·  ASSAM', line: [128, 88, 34] },
    macro: { cell: 4, weave: 'satin', fuzz: 0 },
    garment: 'dress',
  },
]

/* ---------- texture: a flat scan of the cloth ---------- */

// Relief of the weave at scan resolution, -1..1.
function weaveRelief(weave, x, y) {
  if (weave === 'twill') return Math.sin(((x + y) * TAU) / 7)
  if (weave === 'herringbone') {
    const dir = Math.floor(x / 46) % 2 ? 1 : -1
    return Math.sin(((x + dir * y) * TAU) / 7)
  }
  if (weave === 'plain') return Math.sin((x * TAU) / 4) * Math.sin((y * TAU) / 4)
  return 0
}

function texture(cloth) {
  const r = rng(cloth.seed)
  const [canvas, ctx] = layer(TEX_W, TEX_H)
  const img = ctx.createImageData(TEX_W, TEX_H)
  const d = img.data
  const warp = Float32Array.from({ length: TEX_W }, () => r() - 0.5)
  const weft = Float32Array.from({ length: TEX_H }, () => r() - 0.5)
  const [br, bg, bb] = cloth.base
  const reliefAmp = cloth.weave === 'brushed' ? 0 : 0.035
  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      const v =
        1 +
        cloth.heather * (warp[x] * 0.8 + weft[y] * 0.8 + (r() - 0.5) * 1.1) +
        reliefAmp * weaveRelief(cloth.weave, x, y)
      const o = (y * TEX_W + x) * 4
      d[o] = br * v
      d[o + 1] = bg * v
      d[o + 2] = bb * v
      d[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // tonal drift across the length, as in any real scan
  for (let i = 0; i < 120; i++) {
    const x = r() * TEX_W
    const y = r() * TEX_H
    const rad = range(r, 120, 420)
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, r() > 0.5 ? 'rgba(255,248,236,0.016)' : 'rgba(30,18,6,0.016)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }

  // thick-thin yarn: lotus is famous for its slubs
  for (let i = 0; i < 5200 * cloth.slub; i++) {
    const light = r() > 0.35
    ctx.fillStyle = light ? rgba(cloth.base, range(r, 0.25, 0.55), 1.14) : rgba(cloth.base, range(r, 0.2, 0.4), 0.86)
    ctx.fillRect(r() * TEX_W, r() * TEX_H, range(r, 14, 220), r() > 0.6 ? 2 : 1)
  }

  if (cloth.weave === 'satin') {
    // a silk scan still shows soft luster bands where it was not perfectly flat
    for (let x = 0; x < TEX_W; x += 128) {
      const g = ctx.createLinearGradient(x, 0, x + 128, 0)
      g.addColorStop(0, 'rgba(255,240,200,0)')
      g.addColorStop(0.5, `rgba(255,240,200,${range(r, 0.02, 0.07)})`)
      g.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 128, TEX_H)
    }
  }

  if (cloth.nap > 0) {
    fibres(ctx, TEX_W, TEX_H, r, 70000 * cloth.nap, cloth.base.map((c) => c * 1.32), { vertical: 0.85 })
    fibres(ctx, TEX_W, TEX_H, r, 16000 * cloth.nap, cloth.base.map((c) => c * 0.72), { alpha: [0.04, 0.1], vertical: 0.85 })
  }

  selvedge(ctx, cloth)
  grain(ctx, TEX_W, TEX_H, r, 6)
  return canvas
}

// Woven edge carrying the mill's name — the mark of genuine luxury cloth.
function selvedge(ctx, cloth) {
  ctx.fillStyle = rgba(cloth.base, 1, 0.84)
  ctx.fillRect(0, 0, SELVEDGE_W, TEX_H)
  for (let x = 0; x < SELVEDGE_W; x += 2) {
    ctx.fillStyle = x % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
    ctx.fillRect(x, 0, 1, TEX_H)
  }
  ctx.fillStyle = rgba(cloth.selvedge.line)
  ctx.fillRect(4, 0, 1.5, TEX_H)
  ctx.fillRect(SELVEDGE_W - 6, 0, 2, TEX_H)

  ctx.save()
  ctx.translate(SELVEDGE_W / 2 - 6, 0)
  ctx.rotate(Math.PI / 2)
  ctx.font = '600 13px Futura'
  ctx.letterSpacing = '2px'
  ctx.fillStyle = rgba(cloth.selvedge.line, 0.92)
  const label = `${cloth.selvedge.text}  ·  `
  const step = ctx.measureText(label).width
  for (let y = 24; y < TEX_H; y += step) ctx.fillText(label, y, 0)
  ctx.restore()

  // the letters are woven, not printed: break them into threads
  for (let y = 0; y < TEX_H; y += 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(6, y, SELVEDGE_W - 12, 0.8)
  }
}

/* ---------- macro: the cloth re-woven thread by thread ---------- */

function warpOnTop(weave, i, j) {
  if (weave === 'plain') return ((i + j) & 1) === 0
  if (weave === 'twill') return (((i + j) % 4) + 4) % 4 < 2
  if (weave === 'herringbone') {
    return Math.floor(i / 12) % 2 ? (((i + j) % 4) + 4) % 4 < 2 : (((i - j) % 4) + 4) % 4 < 2
  }
  return (i * 2 + j) % 5 !== 0 // 5-end satin: long, light-catching warp floats
}

function macro(cloth, scanTexture) {
  const W = 800
  const H = 1000
  const { cell, weave, fuzz } = cloth.macro
  const r = rng(cloth.seed + 1)
  const cols = Math.ceil(W / cell) + 3
  const rows = Math.ceil(H / cell) + 3
  const warp = Float32Array.from({ length: cols }, () => range(r, 0.9, 1.08))
  const weft = Float32Array.from({ length: rows }, () => range(r, 0.9, 1.08))
  const cellNoise = Float32Array.from({ length: cols * rows }, () => range(r, 0.96, 1.04))
  // slub: smooth thickness swell along a weft thread
  const slubs = Float32Array.from({ length: rows * 16 }, () => (r() < 0.18 ? range(r, 0.1, 0.32) : 0))
  const [br, bg, bb] = cloth.base
  const silk = weave === 'satin'

  const [canvas, ctx] = layer(W, H)
  const img = ctx.createImageData(W, H)
  const d = img.data
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const cx = px + Math.sin(py * 0.029) * 1.6 + Math.sin(py * 0.11) * 0.4
      const cy = py + Math.sin(px * 0.023) * 1.6
      const i = Math.floor(cx / cell) + 2
      const j = Math.floor(cy / cell) + 2
      const fx = cx / cell - Math.floor(cx / cell)
      const fy = cy / cell - Math.floor(cy / cell)
      const top = warpOnTop(weave, i, j)
      const across = top ? fx : fy
      const along = top ? fy : fx
      const slub = cloth.slub ? slubs[j * 16 + Math.floor((i / cols) * 16)] * (top ? 0 : 1) : 0
      const round = Math.pow(Math.sin(Math.PI * Math.min(1, across * (1 - slub) + slub * 0.5)), 0.8)
      const dip = silk ? 0 : Math.pow(Math.abs(along - 0.5) * 2, 3)
      const yarn = (top ? warp[i] : weft[j]) * cellNoise[j * cols + i] * (1 + slub * 0.6)
      const bright = (0.58 + 0.46 * round - 0.22 * dip) * yarn
      const spec = Math.pow(Math.sin(Math.PI * across), silk ? 4 : 10) * (silk ? 95 : 22) * (1 - dip)
      const o = (py * W + px) * 4
      d[o] = br * bright + spec
      d[o + 1] = bg * bright + spec * 0.92
      d[o + 2] = bb * bright + spec * 0.7
      d[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  if (silk) {
    // broad luster sweeping across the floats
    const sweep = ctx.createLinearGradient(0, 0, W, H * 0.6)
    sweep.addColorStop(0, 'rgba(255,236,190,0)')
    sweep.addColorStop(0.45, 'rgba(255,236,190,0.22)')
    sweep.addColorStop(0.62, 'rgba(255,236,190,0)')
    sweep.addColorStop(1, 'rgba(40,20,0,0.2)')
    ctx.fillStyle = sweep
    ctx.fillRect(0, 0, W, H)
  }

  if (fuzz > 0) {
    const light = cloth.base.map((c) => c * 1.45)
    fibres(ctx, W, H, r, 9000 * fuzz, light, { len: [10, 46], width: [0.4, 1], alpha: [0.08, 0.3], vertical: 0.15 })
    // fibres floating above the focal plane
    const [halo, h] = layer(W, H)
    fibres(h, W, H, r, 3200 * fuzz, light, { len: [24, 90], width: [0.8, 1.6], alpha: [0.1, 0.3], vertical: 0.1 })
    ctx.filter = 'blur(2.2px)'
    ctx.drawImage(halo, 0, 0)
    ctx.filter = 'none'
  }

  // raking light from the upper left, then a shallow depth of field
  const light = ctx.createLinearGradient(0, 0, W, H)
  light.addColorStop(0, 'rgba(255,244,224,0.16)')
  light.addColorStop(0.55, 'rgba(0,0,0,0)')
  light.addColorStop(1, 'rgba(20,10,0,0.3)')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, W, H)

  const [blurred, b] = layer(W, H)
  b.filter = 'blur(5px)'
  b.drawImage(canvas, 0, 0)
  b.filter = 'none'
  b.globalCompositeOperation = 'destination-in'
  const focus = b.createLinearGradient(0, 0, 0, H)
  focus.addColorStop(0, 'rgba(0,0,0,1)')
  focus.addColorStop(0.3, 'rgba(0,0,0,0)')
  focus.addColorStop(0.68, 'rgba(0,0,0,0)')
  focus.addColorStop(1, 'rgba(0,0,0,1)')
  b.fillStyle = focus
  b.fillRect(0, 0, W, H)
  ctx.drawImage(blurred, 0, 0)

  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.85)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(12,6,0,0.34)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
  grain(ctx, W, H, r, 6)
  return canvas
}

/* ---------- look: the garment the cloth is classically cut into ---------- */

const mirror = (cmds) => cmds.map(([op, ...a]) => [op, ...a.map((v, k) => (k % 2 ? v : 800 - v))])

function trace(ctx, cmds) {
  ctx.beginPath()
  for (const [op, ...a] of cmds) {
    if (op === 'M') ctx.moveTo(...a)
    else if (op === 'L') ctx.lineTo(...a)
    else if (op === 'Q') ctx.quadraticCurveTo(...a)
    else ctx.closePath()
  }
}

const INK = 'rgba(38,31,25,0.86)'

class Flat {
  constructor(ctx, scan, cloth, r) {
    Object.assign(this, { ctx, scan, cloth, r })
  }

  // cloth fill: scale the scan (minus the selvedge) over the shape's bounds
  fill(cmds, { tone = 1, box = [150, 90, 500, 900] } = {}) {
    const { ctx } = this
    ctx.save()
    trace(ctx, cmds)
    ctx.clip()
    const [x, y, w, h] = box
    ctx.drawImage(this.scan, SELVEDGE_W + 24, 0, TEX_W - SELVEDGE_W - 48, TEX_H, x, y, w, h)
    if (tone !== 1) {
      ctx.fillStyle = tone < 1 ? `rgba(20,12,4,${1 - tone})` : `rgba(255,248,236,${tone - 1})`
      ctx.fillRect(0, 0, 800, 1000)
    }
    ctx.restore()
  }

  shade(cmds, x0, y0, x1, y1, stops) {
    const { ctx } = this
    ctx.save()
    trace(ctx, cmds)
    ctx.clip()
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    for (const [t, c] of stops) g.addColorStop(t, c)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 800, 1000)
    ctx.restore()
  }

  // soft vertical folds falling from a line
  folds(cmds, count, xMin, xMax, yTop, yBottom, strength = 0.14) {
    const { ctx, r } = this
    ctx.save()
    trace(ctx, cmds)
    ctx.clip()
    for (let k = 0; k < count; k++) {
      const x = range(r, xMin, xMax)
      const w = range(r, 10, 22)
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(0.42, `rgba(20,10,0,${strength})`)
      g.addColorStop(0.62, `rgba(255,250,240,${strength * 0.7})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      const top = range(r, yTop, yTop + (yBottom - yTop) * 0.35)
      const drift = range(r, -24, 24)
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x - w + drift, yBottom + 20)
      ctx.lineTo(x + w + drift, yBottom + 20)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  dropShadow(cmds, dx, dy, blur, alpha) {
    const { ctx } = this
    ctx.save()
    ctx.shadowColor = `rgba(50,32,16,${alpha})`
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = dx
    ctx.shadowOffsetY = dy
    ctx.fillStyle = 'rgba(0,0,0,1)'
    trace(ctx, cmds)
    ctx.fill()
    ctx.restore()
  }

  line(cmds, { width = 1.5, dash = null, alpha = 1 } = {}) {
    const { ctx } = this
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.strokeStyle = INK
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (dash) ctx.setLineDash(dash)
    trace(ctx, cmds)
    ctx.stroke()
    ctx.restore()
  }

  button(x, y, rad, color = [58, 40, 28]) {
    const { ctx } = this
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.35, 0, x, y, rad)
    g.addColorStop(0, rgba(color, 1, 1.9))
    g.addColorStop(0.6, rgba(color))
    g.addColorStop(1, rgba(color, 1, 0.6))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, TAU)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath()
      ctx.arc(x + ox * rad * 0.26, y + oy * rad * 0.26, rad * 0.11, 0, TAU)
      ctx.fill()
    }
  }
}

// Overcoat and jacket share one tailored block; length and details differ.
function tailored(f, { hem, cuff, buttons, pocketY, cutaway }) {
  const body = [
    ['M', 358, 132],
    ['Q', 400, 148, 442, 132],
    ['L', 548, 164],
    ['Q', 570, 178, 576, 228],
    ['L', 610, cuff],
    ['L', 540, cuff + 14],
    ['L', 516, 318],
    ['L', 546, hem],
    ...(cutaway ? [['Q', 450, hem + 16, 412, hem - 30]] : [['L', 404, hem]]),
    ['L', 404, hem - (cutaway ? 30 : 0)],
    ...(cutaway ? [['Q', 350, hem + 16, 254, hem]] : [['L', 254, hem]]),
    ['L', 284, 318],
    ['L', 260, cuff + 14],
    ['L', 190, cuff],
    ['L', 224, 228],
    ['Q', 230, 178, 252, 164],
    ['Z'],
  ]
  const sleeveR = [['M', 548, 164], ['Q', 570, 178, 576, 228], ['L', 610, cuff], ['L', 540, cuff + 14], ['L', 516, 318], ['Q', 530, 220, 548, 164], ['Z']]
  const sleeveL = mirror(sleeveR)
  const opening = [['M', 358, 134], ['Q', 372, 300, 398, buttons[0]], ['L', 402, buttons[0]], ['Q', 428, 300, 442, 134], ['Q', 400, 150, 358, 134], ['Z']]
  const lapelL = [['M', 358, 134], ['L', 318, 196], ['L', 334, 206], ['L', 304, 214], ['Q', 312, 330, 398, buttons[0]], ['Q', 372, 300, 358, 134], ['Z']]
  const lapelR = mirror(lapelL)
  const flapL = [['M', 286, pocketY], ['L', 366, pocketY - 6], ['L', 368, pocketY + 28], ['L', 288, pocketY + 34], ['Z']]
  const flapR = mirror(flapL)

  f.dropShadow(body, 12, 20, 36, 0.3)
  f.fill(body)
  f.fill(opening, { tone: 0.42 })
  f.shade(body, 254, 0, 546, 0, [[0, 'rgba(20,10,0,0.3)'], [0.2, 'rgba(0,0,0,0)'], [0.5, 'rgba(255,248,236,0.05)'], [0.8, 'rgba(0,0,0,0)'], [1, 'rgba(20,10,0,0.32)']])
  f.folds(body, 5, 300, 500, 480, hem, 0.1)
  for (const s of [sleeveL, sleeveR]) {
    f.fill(s, { tone: 0.97 })
    const right = s === sleeveR
    f.shade(s, right ? 520 : 280, 0, right ? 612 : 188, 0, [[0, 'rgba(20,10,0,0.28)'], [0.45, 'rgba(255,248,236,0.08)'], [1, 'rgba(20,10,0,0.3)']])
    f.line(s)
  }
  // lapels cast a soft shadow onto the chest
  for (const l of [lapelL, lapelR]) {
    f.ctx.save()
    f.ctx.translate(l === lapelL ? 5 : -5, 7)
    f.dropShadow(l, 0, 0, 14, 0.32)
    f.ctx.restore()
  }
  for (const l of [lapelL, lapelR]) {
    f.fill(l, { tone: 1.03 })
    f.shade(l, 300, 200, 400, 460, [[0, 'rgba(255,248,236,0.1)'], [1, 'rgba(20,10,0,0.18)']])
    f.line(l)
  }
  for (const p of [flapL, flapR]) {
    f.dropShadow(p, 0, 4, 6, 0.3)
    f.fill(p, { tone: 1.02 })
    f.line(p, { width: 1.2 })
  }
  f.line([['M', 452, 340], ['L', 506, 334], ['L', 507, 344], ['L', 453, 350], ['Z']], { width: 1.1 })
  f.line(body)
  f.line([['M', 400, buttons[0]], ['L', 404, hem - (cutaway ? 30 : 0)]])
  f.line([['M', 330, 420], ['L', 326, pocketY - 8]], { width: 0.9, alpha: 0.5 })
  f.line([['M', 470, 420], ['L', 474, pocketY - 8]], { width: 0.9, alpha: 0.5 })
  f.line([['M', 545, cuff - 40], ['L', 606, cuff - 54]], { width: 0.9, dash: [3, 3], alpha: 0.6 })
  f.line([['M', 255, cuff - 40], ['L', 194, cuff - 54]], { width: 0.9, dash: [3, 3], alpha: 0.6 })
  for (const y of buttons) f.button(414, y, 9)
}

function overcoat(f) {
  tailored(f, { hem: 900, cuff: 600, buttons: [470, 590, 710], pocketY: 650, cutaway: false })
}

function jacket(f) {
  tailored(f, { hem: 724, cuff: 588, buttons: [478, 566], pocketY: 610, cutaway: true })
}

function shirt(f) {
  const body = [
    ['M', 362, 140],
    ['Q', 400, 152, 438, 140],
    ['L', 540, 170],
    ['Q', 560, 182, 566, 222],
    ['L', 602, 604],
    ['L', 556, 612],
    ['L', 522, 330],
    ['L', 532, 770],
    ['Q', 500, 836, 400, 846],
    ['Q', 300, 836, 268, 770],
    ['L', 278, 330],
    ['L', 244, 612],
    ['L', 198, 604],
    ['L', 234, 222],
    ['Q', 240, 182, 260, 170],
    ['Z'],
  ]
  const sleeveR = [['M', 540, 170], ['Q', 560, 182, 566, 222], ['L', 602, 604], ['L', 556, 612], ['L', 522, 330], ['Q', 528, 230, 540, 170], ['Z']]
  const sleeveL = mirror(sleeveR)
  const cuffR = [['M', 597, 562], ['L', 604, 612], ['L', 556, 620], ['L', 552, 570], ['Z']]
  const cuffL = mirror(cuffR)
  const band = [['M', 362, 140], ['Q', 400, 128, 438, 140], ['L', 436, 156], ['Q', 400, 146, 364, 156], ['Z']]
  const collarL = [['M', 400, 150], ['L', 360, 134], ['L', 342, 210], ['L', 398, 186], ['Z']]
  const collarR = mirror(collarL)
  const placket = [['M', 389, 176], ['L', 411, 176], ['L', 411, 844], ['L', 389, 844], ['Z']]

  f.dropShadow(body, 10, 18, 32, 0.26)
  f.fill(body)
  f.shade(body, 268, 0, 532, 0, [[0, 'rgba(20,10,0,0.2)'], [0.25, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(20,10,0,0.22)']])
  f.folds(body, 7, 290, 510, 300, 840, 0.1)
  for (const s of [sleeveL, sleeveR]) {
    f.fill(s)
    f.folds(s, 4, s === sleeveR ? 530 : 200, s === sleeveR ? 600 : 270, 260, 600, 0.12)
    f.line(s)
  }
  for (const c of [cuffL, cuffR]) {
    f.fill(c, { tone: 1.03 })
    f.line(c, { width: 1.2 })
  }
  f.fill(band, { tone: 0.8 })
  f.line(band, { width: 1.2 })
  for (const c of [collarL, collarR]) {
    f.dropShadow(c, 0, 6, 10, 0.25)
    f.fill(c, { tone: 1.04 })
    f.line(c, { width: 1.3 })
  }
  f.fill(placket, { tone: 1.02 })
  f.line(body)
  f.line(placket, { width: 1 })
  f.line([['M', 278, 330], ['Q', 400, 300, 522, 330]], { width: 0.8, dash: [3, 3], alpha: 0.4 })
  for (let y = 230; y < 820; y += 92) f.button(400, y, 5.5, [230, 222, 204])
}

function stole(f) {
  const { ctx } = f
  const back = [['M', 400, 162], ['L', 612, 162], ['L', 616, 904], ['L', 404, 904], ['Z']]
  const front = [['M', 300, 162], ['L', 520, 162], ['L', 514, 872], ['L', 294, 872], ['Z']]
  const fringe = (x0, x1, y, len, tone) => {
    for (let x = x0 + 3; x < x1 - 2; x += 4.5) {
      const l = len + range(f.r, -6, 6)
      ctx.strokeStyle = rgba(f.cloth.base, 0.95, tone * range(f.r, 0.85, 1.1))
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(x, y - 2)
      ctx.quadraticCurveTo(x + range(f.r, -3, 3), y + l * 0.5, x + range(f.r, -5, 5), y + l)
      ctx.stroke()
    }
  }
  f.dropShadow(back, 10, 18, 30, 0.24)
  fringe(404, 616, 904, 46, 0.78)
  f.fill(back, { tone: 0.8 })
  f.folds(back, 6, 420, 600, 200, 904, 0.14)
  f.line(back, { width: 1.2 })
  f.dropShadow(front, 10, 18, 30, 0.3)
  fringe(294, 514, 872, 48, 1)
  f.fill(front)
  f.shade(front, 294, 0, 520, 0, [[0, 'rgba(20,10,0,0.18)'], [0.5, 'rgba(255,248,236,0.06)'], [1, 'rgba(20,10,0,0.2)']])
  f.folds(front, 8, 310, 500, 190, 872, 0.16)
  f.line(front)
  // brass rod the stole is folded over
  const rod = ctx.createLinearGradient(0, 148, 0, 176)
  rod.addColorStop(0, '#F2DDA6')
  rod.addColorStop(0.45, '#B78F4C')
  rod.addColorStop(1, '#6E5226')
  ctx.fillStyle = rod
  ctx.beginPath()
  ctx.roundRect(220, 150, 420, 22, 11)
  ctx.fill()
  f.shade(front, 0, 162, 0, 260, [[0, 'rgba(20,10,0,0.34)'], [1, 'rgba(0,0,0,0)']])
}

function dress(f) {
  const { ctx } = f
  const body = [
    ['M', 350, 238],
    ['Q', 378, 252, 400, 302],
    ['Q', 422, 252, 450, 238],
    ['Q', 474, 252, 478, 302],
    ['Q', 470, 384, 462, 432],
    ['Q', 504, 650, 596, 906],
    ['Q', 400, 940, 204, 906],
    ['Q', 296, 650, 338, 432],
    ['Q', 330, 384, 322, 302],
    ['Q', 326, 252, 350, 238],
    ['Z'],
  ]
  f.dropShadow(body, 10, 18, 32, 0.28)
  for (const x of [356, 444]) {
    ctx.strokeStyle = rgba(f.cloth.base, 1, 0.9)
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, 240)
    ctx.lineTo(x + (x < 400 ? 8 : -8), 112)
    ctx.stroke()
  }
  f.fill(body, { box: [180, 200, 440, 760] })
  // silk luster: bright bias folds and deep troughs
  ctx.save()
  trace(ctx, body)
  ctx.clip()
  for (let k = 0; k < 9; k++) {
    const t = k / 8
    const xTop = 344 + t * 112
    const xBot = 220 + t * 360 + range(f.r, -16, 16)
    const bright = k % 2 === 0
    ctx.strokeStyle = bright ? `rgba(255,240,200,${range(f.r, 0.16, 0.3)})` : `rgba(40,20,0,${range(f.r, 0.14, 0.26)})`
    ctx.lineWidth = range(f.r, 14, 30)
    ctx.filter = 'blur(10px)'
    ctx.beginPath()
    ctx.moveTo(xTop, 430)
    ctx.quadraticCurveTo((xTop + xBot) / 2 + range(f.r, -30, 30), 680, xBot, 930)
    ctx.stroke()
  }
  ctx.filter = 'none'
  ctx.restore()
  f.shade(body, 204, 0, 596, 0, [[0, 'rgba(20,10,0,0.3)'], [0.3, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0)'], [1, 'rgba(20,10,0,0.32)']])
  f.shade(body, 0, 240, 0, 440, [[0, 'rgba(255,240,200,0.14)'], [1, 'rgba(0,0,0,0)']])
  f.line(body)
  f.line([['M', 338, 432], ['Q', 400, 446, 462, 432]], { width: 0.9, dash: [3, 3], alpha: 0.45 })
}

const GARMENTS = { overcoat, jacket, shirt, stole, dress }

function look(cloth, scanTexture) {
  const W = 800
  const H = 1000
  const r = rng(cloth.seed + 2)
  const [canvas, ctx] = layer(W, H)
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#EFE8DC')
  bg.addColorStop(1, '#E1D7C6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.translate(0, cloth.garment === 'jacket' ? 70 : cloth.garment === 'shirt' ? 30 : 0)
  GARMENTS[cloth.garment](new Flat(ctx, scanTexture, cloth, r))
  ctx.restore()
  grain(ctx, W, H, r, 7)
  return canvas
}

/* ---------- run ---------- */

const only = process.argv[2]
for (const cloth of CLOTHS) {
  if (only && only !== cloth.id) continue
  const dir = new URL(`${cloth.id}/`, OUT_DIR)
  await mkdir(dir, { recursive: true })
  const scan = texture(cloth)
  await writeFile(new URL('texture.webp', dir), await scan.encode('webp', 84))
  await writeFile(new URL('macro.webp', dir), await macro(cloth, scan).encode('webp', 82))
  await writeFile(new URL('look.webp', dir), await look(cloth, scan).encode('webp', 84))
  console.log(`✓ ${cloth.id}`)
}
