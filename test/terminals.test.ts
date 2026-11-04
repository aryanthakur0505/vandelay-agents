import { afterEach, describe, expect, it } from 'vitest'
import { agentBaseEnv, findExecutable, isShell } from '../src/main/terminals'

describe('isShell', () => {
  it('knows plain shells, whatever the path or extension', () => {
    for (const cmd of ['powershell.exe', 'pwsh', 'cmd.exe', 'bash', '/bin/zsh', 'fish']) expect(isShell(cmd)).toBe(true)
    for (const cmd of ['claude', 'codex', 'node']) expect(isShell(cmd)).toBe(false)
  })
})

describe('findExecutable', () => {
  it('finds node on PATH and nothing for a made-up command', () => {
    expect(findExecutable('node')).toBeTruthy()
    expect(findExecutable('vandelay-no-such-command')).toBeNull()
  })
})

describe('agentBaseEnv', () => {
  const saved = { ...process.env }
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  })

  it("drops a host Claude Code session's variables so agents start their own", () => {
    process.env.CLAUDECODE = '1'
    process.env.CLAUDE_CODE_ENTRYPOINT = 'cli'
    process.env.VANDELAY_KEEP = 'yes'
    const env = agentBaseEnv()
    expect(env.CLAUDECODE).toBeUndefined()
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBeUndefined()
    expect(env.VANDELAY_KEEP).toBe('yes')
  })
})
