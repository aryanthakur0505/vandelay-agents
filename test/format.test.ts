import { describe, expect, it } from 'vitest'
import { addressLabel, clock, time } from '../src/renderer/src/format'

describe('clock', () => {
  it('formats durations as hh:mm:ss', () => {
    expect(clock(0)).toBe('00:00:00')
    expect(clock(61_000)).toBe('00:01:01')
    expect(clock(3_725_999)).toBe('01:02:05')
  })

  it('never shows a negative uptime', () => {
    expect(clock(-5000)).toBe('00:00:00')
  })
})

describe('time', () => {
  it('uses a 24-hour clock', () => {
    expect(time(new Date(2026, 0, 1, 23, 5, 9).getTime())).toMatch(/23.05.09/)
  })
})

describe('addressLabel', () => {
  it('names the human and the app, and shouts agent ids', () => {
    expect([addressLabel('you'), addressLabel('vandelay'), addressLabel('jackie-chiles')]).toEqual(['YOU', 'SYSTEM', 'JACKIE-CHILES'])
  })
})
