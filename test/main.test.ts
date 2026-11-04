import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeArgs, claudeHookArgs, isClaude, stopOrphans } from '../src/main/claudeHooks'
import { ensureWorktree } from '../src/main/worktrees'
import { scratch } from './helpers'

function repo(): string {
  const dir = scratch()
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'README.md'), 'hi\n')
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init')
  return dir
}

describe('ensureWorktree', () => {
  it('creates a worktree on vandelay/<id> and reuses it', async () => {
    const dir = repo()
    const wt = join(dir, '.vandelay', 'worktrees', 'kramer')
    expect(await ensureWorktree(dir, wt, 'kramer')).toBe('vandelay/kramer')
    expect(readFileSync(join(wt, 'README.md'), 'utf8').trim()).toBe('hi')
    expect(await ensureWorktree(dir, wt, 'kramer')).toBe('vandelay/kramer')
  })

  it('fails outside a git repository', async () => {
    const dir = scratch()
    await expect(ensureWorktree(dir, join(dir, 'wt'), 'kramer')).rejects.toThrow()
  })
})

describe('stopOrphans', () => {
  it("stops processes started with the agent's settings file, and only those", async () => {
    const root = scratch()
    const mine = join(root, 'agents', 'kramer')
    const idle = ['-e', 'setTimeout(() => {}, 60000)']
    const orphan = spawn(process.execPath, [...idle, join(mine, 'claude-settings.json')])
    const bystander = spawn(process.execPath, [...idle, join(root, 'agents', 'elaine', 'claude-settings.json')])
    const exited = new Promise((r) => orphan.on('exit', r))
    await stopOrphans(mine)
    await exited
    expect(bystander.exitCode).toBeNull()
    bystander.kill()
  })
})

describe('claudeHookArgs', () => {
  it('writes settings with the hooks and an own-folder permission', () => {
    const root = scratch()
    const agentDir = join(root, 'agents', 'kramer')
    mkdirSync(agentDir, { recursive: true })
    const args = claudeHookArgs(root, { id: 'kramer', name: 'Kramer', command: 'claude', args: [], cwd: '', color: '' }, agentDir)
    expect(args?.[0]).toBe('--settings')
    const settings = JSON.parse(readFileSync(args![1], 'utf8'))
    expect(Object.keys(settings.hooks)).toEqual(['SessionStart', 'Stop'])
    const rule: string = settings.permissions.allow[0]
    expect(rule).toMatch(/^Edit\(\/\/.*\/agents\/kramer\/\*\*\)$/)
    expect(rule).not.toContain('\\')
    expect(existsSync(join(root, 'bin', 'claude-mail-hook.cjs'))).toBe(true)
  })
})

describe('claudeArgs', () => {
  const base = { id: 'g', name: 'G', command: 'claude', args: [], cwd: '', color: '' }

  it('passes nothing for the defaults', () => {
    expect(claudeArgs(base)).toEqual([])
    expect(claudeArgs({ ...base, autonomy: 'inherit' })).toEqual([])
  })

  it('maps model and autonomy to flags', () => {
    expect(claudeArgs({ ...base, model: 'haiku', autonomy: 'read-only' })).toEqual(['--model', 'haiku', '--permission-mode', 'plan'])
    expect(claudeArgs({ ...base, autonomy: 'edits' })).toEqual(['--permission-mode', 'acceptEdits'])
    expect(claudeArgs({ ...base, autonomy: 'ask' })).toEqual(['--permission-mode', 'manual'])
    expect(claudeArgs({ ...base, autonomy: 'auto' })).toEqual(['--permission-mode', 'auto'])
  })
})

describe('isClaude', () => {
  it('recognises claude by name, shim or full path', () => {
    for (const cmd of ['claude', 'Claude.exe', 'claude.cmd', join('tools', 'bin', 'claude')]) expect(isClaude(cmd)).toBe(true)
    for (const cmd of ['codex', 'claude-dev', 'powershell.exe']) expect(isClaude(cmd)).toBe(false)
  })
})
