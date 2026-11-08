import { YOU } from './ids'
import type { HiveMessage } from './types'

/** A message to the human that asks for a decision (agents start those with `QUESTION:`). */
export function isQuestion(m: Pick<HiveMessage, 'to' | 'body'>): boolean {
  return m.to === YOU && /^\s*\**question\**\s*:/i.test(m.body)
}
