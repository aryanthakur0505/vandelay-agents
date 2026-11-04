import { describe, expect, it } from 'vitest'
import { STATUS_LABEL, statusColors, terminalTheme, unitTag } from '../src/renderer/src/status'

describe('status helpers', () => {
  it('numbers units from 01', () => {
    expect([unitTag(0), unitTag(9), unitTag(41)]).toEqual(['UNIT-01', 'UNIT-10', 'UNIT-42'])
  })

  it('has a color and a label for every status in both themes', () => {
    for (const theme of ['control', 'office'] as const) {
      const colors = statusColors(theme)
      for (const status of Object.keys(STATUS_LABEL)) expect(colors[status as keyof typeof colors]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("uses the agent's color for the terminal cursor", () => {
    expect(terminalTheme('control', '#123456').cursor).toBe('#123456')
    expect(terminalTheme('office', '#abcdef').cursor).toBe('#abcdef')
  })
})
