import { SYSTEM, YOU } from '@shared/ids'

/** A duration as `hh:mm:ss`, for uptimes. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** A timestamp as a 24-hour wall-clock time. */
export function time(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour12: false })
}

/** How a mail address reads in the comms log. */
export function addressLabel(id: string): string {
  if (id === YOU) return 'YOU'
  if (id === SYSTEM) return 'SYSTEM'
  return id.toUpperCase()
}

/** An unread count that fits a small badge. */
export function badgeCount(n: number): string {
  return n > 99 ? '99+' : String(n)
}

export const FONT_SIZE = { min: 9, max: 24, default: 13 }

/** A terminal font size one step bigger or smaller, kept within readable limits. */
export function nextFontSize(size: number, step: number): number {
  return Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size) + step))
}

/** A short age like `40s`, `12m` or `3h`, for how long something has waited. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
