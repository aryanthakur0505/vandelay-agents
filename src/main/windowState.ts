import { readFileSync, writeFileSync } from 'node:fs'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  bounds: Rect
  maximized: boolean
}

export const DEFAULT_SIZE = { width: 1400, height: 900 }
export const MIN_SIZE = { width: 900, height: 600 }

/**
 * Saved bounds, if they still make sense: big enough, and mostly on a screen that's still attached
 * (a laptop unplugged from its monitor would otherwise open the window off-screen).
 */
export function usableBounds(saved: Rect | undefined, screens: Rect[]): Rect | undefined {
  if (!saved || saved.width < MIN_SIZE.width || saved.height < MIN_SIZE.height) return undefined
  const visible = screens.some((s) => {
    const w = Math.min(saved.x + saved.width, s.x + s.width) - Math.max(saved.x, s.x)
    const h = Math.min(saved.y + saved.height, s.y + s.height) - Math.max(saved.y, s.y)
    return w >= 200 && h >= 100
  })
  return visible ? saved : undefined
}

export function loadWindowState(file: string): WindowState | undefined {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'))
    if (state && typeof state.bounds?.width === 'number') return state as WindowState
  } catch {
    // First run, or unreadable: use the defaults.
  }
  return undefined
}

export function saveWindowState(file: string, state: WindowState): void {
  try {
    writeFileSync(file, JSON.stringify(state))
  } catch {
    // Not worth bothering anyone about.
  }
}
