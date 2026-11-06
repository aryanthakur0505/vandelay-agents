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
