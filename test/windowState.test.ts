import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadWindowState, saveWindowState, usableBounds } from '../src/main/windowState'
import { scratch } from './helpers'

const laptop = { x: 0, y: 0, width: 1920, height: 1080 }
const monitor = { x: 1920, y: 0, width: 2560, height: 1440 }

describe('usableBounds', () => {
  it('keeps bounds that are on an attached screen', () => {
    const saved = { x: 2100, y: 100, width: 1400, height: 900 }
    expect(usableBounds(saved, [laptop, monitor])).toEqual(saved)
  })

  it('drops bounds on a screen that has gone', () => {
    expect(usableBounds({ x: 2100, y: 100, width: 1400, height: 900 }, [laptop])).toBeUndefined()
  })

  it('drops bounds smaller than the minimum window', () => {
    expect(usableBounds({ x: 0, y: 0, width: 300, height: 200 }, [laptop])).toBeUndefined()
    expect(usableBounds(undefined, [laptop])).toBeUndefined()
  })
})

describe('window state file', () => {
  it('round-trips, and ignores junk', () => {
    const file = join(scratch(), 'window.json')
    expect(loadWindowState(file)).toBeUndefined()
    saveWindowState(file, { bounds: { x: 1, y: 2, width: 1000, height: 700 }, maximized: true })
    expect(loadWindowState(file)).toEqual({ bounds: { x: 1, y: 2, width: 1000, height: 700 }, maximized: true })
    writeFileSync(file, '{"nope": 1}')
    expect(loadWindowState(file)).toBeUndefined()
  })
})
