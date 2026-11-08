import { describe, expect, it } from 'vitest'
import type { HiveMessage } from '../src/shared/types'
import { openTasks, taskCounts } from '../src/renderer/src/tasks'

let clock = 0
const msg = (from: string, to: string, body = ''): HiveMessage => {
  clock += 1000
  return { id: `${clock}-${from}`, from, to, body, file: '', at: clock }
}

describe('openTasks', () => {
  it('keeps a brief open until its owner replies to the requester', () => {
    const brief = msg('you', 'art', 'Ship it')
    const sub = msg('art', 'kramer', 'Prototype it')
    expect(openTasks([sub, brief]).map((t) => `${t.requester}->${t.owner}`)).toEqual(['art->kramer', 'you->art'])
    const done = msg('kramer', 'art', 'Done')
    // Kramer's reply closes his task, and a reply is a report, not a new task for Art.
    expect(openTasks([brief, sub, done]).map((t) => `${t.requester}->${t.owner}`)).toEqual(['you->art'])
    expect(openTasks([brief, sub, done, msg('art', 'you', 'Shipped')])).toEqual([])
  })

  it('ignores app notices and closes several briefs with one reply', () => {
    const a = msg('art', 'elaine', 'Docs')
    const b = msg('art', 'elaine', 'And the changelog')
    const notice = msg('vandelay', 'art', 'New hire')
    expect(openTasks([a, b, notice])).toHaveLength(2)
    expect(openTasks([a, b, notice, msg('elaine', 'art', 'Both done')])).toEqual([])
  })

  it('counts open tasks per owner', () => {
    const tasks = openTasks([msg('art', 'kramer'), msg('art', 'kramer'), msg('you', 'art')])
    expect(taskCounts(tasks)).toEqual({ kramer: 2, art: 1 })
  })
})
