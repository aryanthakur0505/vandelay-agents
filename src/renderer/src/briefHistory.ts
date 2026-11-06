/** How many sent briefs the composer remembers. */
export const HISTORY_MAX = 50

/** Adds a sent brief to the front, dropping an older copy of the same text and anything past the cap. */
export function remember(history: string[], brief: string, max = HISTORY_MAX): string[] {
  const text = brief.trim()
  if (!text) return history
  return [text, ...history.filter((h) => h !== text)].slice(0, max)
}

/**
 * Moves through history like a shell: `older` from -1 (not browsing) goes to the newest brief, and
 * `newer` past the newest goes back to -1. Returns the new index.
 */
export function step(history: string[], index: number, direction: 'older' | 'newer'): number {
  if (direction === 'older') return Math.min(index + 1, history.length - 1)
  return Math.max(index - 1, -1)
}
