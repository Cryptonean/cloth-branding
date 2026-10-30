import { describe, expect, it } from 'vitest'
import { LIGHT_KEYS, lightLabel, roomVars, sampleLight, timeOfDay } from './lightRig'

const at = (hours: number, minutes = 0) => new Date(2026, 9, 30, hours, minutes)

describe('sampleLight', () => {
  it('returns each key exactly at its own position', () => {
    for (const key of LIGHT_KEYS) expect(sampleLight(key.at)).toEqual(key.light)
  })

  it('blends halfway between neighbouring keys', () => {
    const [morning, golden] = LIGHT_KEYS
    const mid = sampleLight((morning.at + golden.at) / 2)
    expect(mid.sun.intensity).toBeCloseTo((morning.light.sun.intensity + golden.light.sun.intensity) / 2)
    expect(mid.room.wall[0]).toBeCloseTo((morning.light.room.wall[0] + golden.light.room.wall[0]) / 2)
  })

  it('clamps outside the day', () => {
    expect(sampleLight(-1)).toEqual(LIGHT_KEYS[0].light)
    expect(sampleLight(2)).toEqual(LIGHT_KEYS[LIGHT_KEYS.length - 1].light)
  })

  it('puts the sun out and the lamp on after dark', () => {
    const night = sampleLight(1)
    expect(night.sun.intensity).toBe(0)
    expect(night.lamp).toBeGreaterThan(0)
  })
})

describe('timeOfDay', () => {
  it('is lamplight late at night and before six', () => {
    expect(timeOfDay(at(23))).toBe(1)
    expect(timeOfDay(at(3))).toBe(1)
  })

  it('is morning light just after six', () => {
    expect(timeOfDay(at(6, 30))).toBeLessThan(0.1)
  })

  it('reaches golden hour in the late afternoon and dusk by half past six', () => {
    expect(lightLabel(timeOfDay(at(16, 30)))).toBe('Golden hour')
    expect(lightLabel(timeOfDay(at(18, 30)))).toBe('Dusk')
  })
})

describe('roomVars', () => {
  it('turns a light state into CSS custom properties', () => {
    const vars = roomVars(sampleLight(1))
    expect(vars['--color-ink']).toBe('rgb(239 231 218)')
    expect(vars['--shaft-opacity']).toBe('0.000')
    expect(vars['--vignette']).toBe('28%')
  })
})
