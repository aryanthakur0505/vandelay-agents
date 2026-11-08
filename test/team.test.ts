import { describe, expect, it } from 'vitest'
import type { AgentConfig } from '../src/shared/types'
import { parseTeamFile, teamFile } from '../src/shared/team'

const agent = (over: Partial<AgentConfig>): AgentConfig => ({ id: 'x', name: 'X', command: 'claude', args: [], cwd: '', color: '#000', ...over })

describe('team files', () => {
  it('round-trips the hires, leaving out the orchestrator, temps, ids and colors', () => {
    const text = teamFile([
      agent({ id: 'art', name: 'Art Vandelay', orchestrator: true }),
      agent({ id: 'george', name: 'George', role: 'Reviews.', model: 'sonnet', autonomy: 'read-only', worktree: true }),
      agent({ id: 'bania', name: 'Bania', temp: true, hiredBy: 'art' })
    ])
    expect(text).not.toContain('"id"')
    expect(text).not.toContain('#000')
    expect(parseTeamFile(text)).toEqual([
      { name: 'George', command: 'claude', args: [], cwd: '', role: 'Reviews.', model: 'sonnet', autonomy: 'read-only', worktree: true }
    ])
  })

  it('drops unknown fields and bad values', () => {
    const text = JSON.stringify({
      vandelayTeam: 1,
      agents: [{ name: ' Jerry ', command: ' claude ', args: ['--x', 3], orchestrator: true, autonomy: 'yolo', color: 'red' }]
    })
    expect(parseTeamFile(text)).toEqual([{ name: 'Jerry', command: 'claude', args: ['--x'], cwd: '' }])
  })

  it('explains what is wrong with a bad file', () => {
    expect(() => parseTeamFile('nope')).toThrow(/isn't JSON/)
    expect(() => parseTeamFile('{"agents": []}')).toThrow(/isn't a Vandelay team file/)
    expect(() => parseTeamFile('{"vandelayTeam": 1, "agents": [{"command": "claude"}]}')).toThrow(/Agent 1 has no name/)
    expect(() => parseTeamFile('{"vandelayTeam": 1, "agents": [{"name": "Kenny"}]}')).toThrow(/Kenny has no command/)
  })
})
