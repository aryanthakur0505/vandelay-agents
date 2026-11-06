import { describe, expect, it } from 'vitest'
import type { HiveMessage } from '../src/shared/types'
import { commsFileName, commsMarkdown } from '../src/renderer/src/commsExport'

const msg = (from: string, to: string, body: string, at: number): HiveMessage => ({ id: String(at), from, to, body, file: '', at })

describe('commsMarkdown', () => {
  it('writes the transcript oldest first, with who sent what to whom', () => {
    const md = commsMarkdown([msg('art', 'you', 'Done.', 2000), msg('you', 'art', 'Build it.', 1000)], 'D:\\work')
    expect(md).toContain('Workspace: `D:\\work`')
    expect(md.indexOf('Build it.')).toBeLessThan(md.indexOf('Done.'))
    expect(md).toContain('## 1970-01-01T00:00:01.000Z · YOU → ART')
  })
})

describe('commsFileName', () => {
  it('stamps the date and time', () => {
    expect(commsFileName(new Date(2026, 10, 6, 9, 5))).toBe('vandelay-comms-2026-11-06-0905.md')
  })
})
