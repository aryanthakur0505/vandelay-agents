import { describe, expect, it } from 'vitest'
import type { HiveMessage } from '../src/shared/types'
import { isQuestion, openTasks, pendingQuestions, taskCounts } from '../src/renderer/src/tasks'

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

describe('questions for the human', () => {
  it('recognises QUESTION: in plain or bold markdown, only when addressed to you', () => {
    expect(isQuestion(msg('art', 'you', 'QUESTION: ship on Friday?'))).toBe(true)
    expect(isQuestion(msg('art', 'you', '**Question:** delete the old API?'))).toBe(true)
    expect(isQuestion(msg('art', 'you', 'Shipped. Any question: ask.'))).toBe(false)
    expect(isQuestion(msg('art', 'kramer', 'QUESTION: lunch?'))).toBe(false)
  })

  it('keeps a question pending until you write to the asker', () => {
    const q = msg('art', 'you', 'QUESTION: Postgres or SQLite?')
    const other = msg('you', 'kramer', 'unrelated')
    expect(pendingQuestions([other, q])).toEqual([q])
    expect(pendingQuestions([q, other, msg('you', 'art', 'Postgres')])).toEqual([])
  })
})
