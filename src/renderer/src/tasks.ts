import { SYSTEM, YOU } from '@shared/ids'
import type { HiveMessage } from '@shared/types'

export interface OpenTask {
  /** The brief that is still waiting. */
  brief: HiveMessage
  /** Who it waits on: the agent the brief went to. */
  owner: string
  /** Who asked, and gets the reply. */
  requester: string
}

/**
 * Briefs nobody has answered yet. A message to an agent is a task until that agent writes back to
 * whoever sent it; any later message from the agent to the requester closes every earlier brief
 * between them. Notices from the app and replies to the human aren't tasks.
 */
export function openTasks(log: HiveMessage[]): OpenTask[] {
  const oldestFirst = [...log].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  const open: OpenTask[] = []
  for (const m of oldestFirst) {
    // A reply closes what the replier owed the recipient, and is a report, not a new request.
    const before = open.length
    for (let i = open.length - 1; i >= 0; i--) if (open[i].owner === m.from && open[i].requester === m.to) open.splice(i, 1)
    const isReply = open.length < before
    if (!isReply && m.from !== SYSTEM && m.to !== YOU) open.push({ brief: m, owner: m.to, requester: m.from })
  }
  return open.reverse()
}

/** Open tasks per agent, for badges. */
export function taskCounts(tasks: OpenTask[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const t of tasks) counts[t.owner] = (counts[t.owner] ?? 0) + 1
  return counts
}

/** A message to the human that asks for a decision (agents start those with `QUESTION:`). */
export function isQuestion(m: HiveMessage): boolean {
  return m.to === YOU && /^\s*\**question\**\s*:/i.test(m.body)
}

/** Questions to the human that they haven't answered: no message from you to the asker since. */
export function pendingQuestions(log: HiveMessage[]): HiveMessage[] {
  const answeredAt: Record<string, number> = {}
  for (const m of log) if (m.from === YOU) answeredAt[m.to] = Math.max(answeredAt[m.to] ?? 0, m.at)
  return log.filter((m) => isQuestion(m) && (answeredAt[m.from] ?? 0) < m.at)
}
