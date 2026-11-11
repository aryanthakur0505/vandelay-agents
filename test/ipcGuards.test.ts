import { describe, expect, it } from 'vitest'
import { agentInput, agentPatch, int, oneOf, text } from '../src/main/ipcGuards'

describe('IPC guards', () => {
  it('accept the right types and reject the rest', () => {
    expect(text('hi', 'x')).toBe('hi')
    expect(() => text(42, 'x')).toThrow(/must be text/)
    expect(() => text('x'.repeat(11), 'x', 10)).toThrow(/too long/)
    expect(int(80, 'cols', 2, 1000)).toBe(80)
    expect(() => int(1.5, 'cols', 2, 1000)).toThrow(/out of range/)
    expect(() => int(5000, 'cols', 2, 1000)).toThrow(/out of range/)
    expect(oneOf('held', 'kind', ['held', 'dead-letter'])).toBe('held')
    expect(() => oneOf('../x', 'kind', ['held', 'dead-letter'])).toThrow(/one of/)
  })

  it('keep only known agent fields, checked', () => {
    expect(agentPatch({ name: 'Jerry', orchestrator: true, temp: true, hiredBy: 'x', id: 'evil', worktree: 'yes' })).toEqual({
      name: 'Jerry',
      worktree: false
    })
    expect(() => agentPatch({ autonomy: 'root' })).toThrow(/autonomy/)
    expect(() => agentPatch({ args: 'rm -rf /' })).toThrow(/list/)
    expect(() => agentPatch(null)).toThrow(/object/)
  })

  it('require a name and command for a hire, and fill in the rest', () => {
    expect(agentInput({ name: 'Jerry', command: 'claude', color: '#ffffff' })).toEqual({ name: 'Jerry', command: 'claude', args: [], cwd: '' })
    expect(() => agentInput({ name: 'Jerry' })).toThrow(/name and a command/)
  })
})
