import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { initLog, log } from '../src/main/log'
import { scratch } from './helpers'

describe('log', () => {
  it('appends timestamped lines, with error stacks', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = initLog(join(scratch(), 'logs'))
    log.info('started', { agents: 8 })
    log.error('boom', new Error('kaput'))
    const text = readFileSync(file, 'utf8')
    expect(text).toMatch(/^\d{4}-\d\d-\d\dT.*Z INFO started \{"agents":8\}$/m)
    expect(text).toContain('ERROR boom Error: kaput')
    vi.restoreAllMocks()
  })

  it('starts a new file once the log passes 1 MB', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const dir = join(scratch(), 'logs')
    const file = initLog(dir)
    writeFileSync(file, 'x'.repeat(1_000_001))
    log.info('fresh')
    expect(readFileSync(file, 'utf8')).toMatch(/INFO fresh\n$/)
    expect(existsSync(join(dir, 'vandelay.old.log'))).toBe(true)
    vi.restoreAllMocks()
  })
})
