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
    // A reply closes what the replier owed the recipient.
    for (let i = open.length - 1; i >= 0; i--) if (open[i].owner === m.from && open[i].requester === m.to) open.splice(i, 1)
    if (m.from !== SYSTEM && m.to !== YOU) open.push({ brief: m, owner: m.to, requester: m.from })
  }
  return open.reverse()
}

/** Open tasks per agent, for badges. */
export function taskCounts(tasks: OpenTask[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const t of tasks) counts[t.owner] = (counts[t.owner] ?? 0) + 1
  return counts
}
