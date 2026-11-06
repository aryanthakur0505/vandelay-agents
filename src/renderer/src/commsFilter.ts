import type { HiveMessage } from '@shared/types'

export interface CommsFilter {
  /** Only messages to or from this address; empty for everyone. */
  party: string
  /** Case-insensitive text to look for in the body or either address. */
  query: string
}

export const NO_FILTER: CommsFilter = { party: '', query: '' }

export function filterLog(log: HiveMessage[], { party, query }: CommsFilter): HiveMessage[] {
  const q = query.trim().toLowerCase()
  return log.filter(
    (m) =>
      (!party || m.from === party || m.to === party) &&
      (!q || m.body.toLowerCase().includes(q) || m.from.includes(q) || m.to.includes(q))
  )
}
