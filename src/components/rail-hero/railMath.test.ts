import { describe, expect, it } from 'vitest'
import { edgeOpacity, ringDelta, settleTarget, slotPose, wrapSlot } from './railMath'

describe('wrapSlot', () => {
  it('keeps every cloth within half a ring of the centre', () => {
    for (let offset = -7; offset <= 7; offset += 0.25) {
      for (let i = 0; i < 5; i++) {
        const slot = wrapSlot(i, offset, 5)
        expect(slot).toBeGreaterThanOrEqual(-2.5)
        expect(slot).toBeLessThan(2.5)
      }
    }
  })

  it('centres the cloth the rail has moved to, however far it has travelled', () => {
    expect(wrapSlot(3, 3, 5)).toBe(0)
    expect(wrapSlot(3, 8, 5)).toBe(0)
    expect(wrapSlot(0, -1, 5)).toBe(1)
  })

  it('wraps the far-right cloth round to the left end', () => {
    expect(wrapSlot(3, 0, 5)).toBe(-2)
  })
})

describe('ringDelta', () => {
  it('takes the short way round the ring', () => {
    expect(ringDelta(0, 4, 5)).toBe(-1)
    expect(ringDelta(4, 0, 5)).toBe(1)
    expect(ringDelta(1, 3, 5)).toBe(2)
  })
})

describe('edgeOpacity', () => {
  it('is fully visible at every resting slot', () => {
    for (const slot of [-2, -1, 0, 1, 2]) expect(edgeOpacity(slot, 5)).toBe(1)
  })

  it('vanishes at the wrap point', () => {
    expect(edgeOpacity(2.49, 5)).toBe(0)
    expect(edgeOpacity(-2.5, 5)).toBe(0)
  })
})

describe('slotPose', () => {
  it('puts slot 0 at the front of the arc, facing forward', () => {
    expect(slotPose(0)).toEqual({ x: 0, z: 0, angle: 0 })
  })

  it('is mirror-symmetric about the centre', () => {
    const right = slotPose(1.5)
    const left = slotPose(-1.5)
    expect(right.x).toBeCloseTo(-left.x)
    expect(right.z).toBeCloseTo(left.z)
    expect(right.z).toBeLessThan(0)
  })
})

describe('settleTarget', () => {
  it('rounds to the nearest cloth when released still', () => {
    expect(settleTarget(2.4, 0)).toBe(2)
  })

  it('carries a flick on to the next cloth', () => {
    expect(settleTarget(2.4, 3)).toBe(3)
  })

  it('caps a hard flick at two cloths', () => {
    expect(settleTarget(0, 100)).toBe(2)
    expect(settleTarget(0, -100)).toBe(-2)
  })
})
