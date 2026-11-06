import { describe, expect, it } from 'vitest'
import type { HiveMessage } from '../src/shared/types'
import { filterLog, NO_FILTER } from '../src/renderer/src/commsFilter'

const msg = (from: string, to: string, body: string): HiveMessage => ({ id: `${from}-${to}`, from, to, body, file: '', at: 0 })
const log = [
  msg('you', 'art', 'Ship the parser'),
  msg('art', 'kramer', 'Prototype a PARSER'),
  msg('kramer', 'art', 'Done'),
  msg('art', 'you', 'All set')
]

describe('filterLog', () => {
  it('keeps everything without a filter', () => {
    expect(filterLog(log, NO_FILTER)).toHaveLength(4)
  })

  it('keeps messages to or from one party', () => {
    expect(filterLog(log, { party: 'kramer', query: '' }).map((m) => m.id)).toEqual(['art-kramer', 'kramer-art'])
  })

  it('searches bodies case-insensitively, and addresses', () => {
    expect(filterLog(log, { party: '', query: '  parser ' }).map((m) => m.id)).toEqual(['you-art', 'art-kramer'])
    expect(filterLog(log, { party: '', query: 'kram' }).map((m) => m.id)).toEqual(['art-kramer', 'kramer-art'])
  })

  it('combines both', () => {
    expect(filterLog(log, { party: 'you', query: 'set' }).map((m) => m.id)).toEqual(['art-you'])
  })
})
