import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scratch } from './helpers'

const HOOK = resolve('src/main/hooks/claude-mail-hook.cjs')

function agentDir(): string {
  const root = scratch()
  writeFileSync(join(root, 'agents.json'), JSON.stringify([{ id: 'kramer', name: 'Kramer' }]))
  writeFileSync(join(root, 'PROTOCOL.md'), '# protocol')
  const dir = join(root, 'agents', 'kramer')
  for (const sub of ['inbox', 'archive']) mkdirSync(join(dir, sub), { recursive: true })
  return dir
}

function run(mode: string, dir: string): { done: Promise<{ code: number | null; stdout: string; stderr: string }>; kill(): void } {
  const child = spawn(process.execPath, [HOOK, mode, dir], { stdio: ['pipe', 'pipe', 'pipe'] })
  child.stdin.end('{}')
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => (stdout += d))
  child.stderr.on('data', (d) => (stderr += d))
  return {
    done: new Promise((r) => child.on('exit', (code) => r({ code, stdout, stderr }))),
    kill: () => child.kill()
  }
}

describe('claude-mail-hook', () => {
  it('context tells Claude who it is', async () => {
    const { code, stdout } = await run('context', agentDir()).done
    expect(code).toBe(0)
    const out = JSON.parse(stdout).hookSpecificOutput
    expect(out.hookEventName).toBe('SessionStart')
    expect(out.additionalContext).toContain('You are Kramer (agent id "kramer")')
  })

  it('watch hands over new mail, files it in archive/ and exits 2', async () => {
    const dir = agentDir()
    writeFileSync(join(dir, 'inbox', '1-art.md'), 'from: art\n---\nGiddyup?')
    const { code, stderr } = await run('watch', dir).done
    expect(code).toBe(2)
    expect(stderr).toContain('Giddyup?')
    expect(readdirSync(join(dir, 'inbox'))).toEqual([])
    expect(readdirSync(join(dir, 'archive'))).toEqual(['1-art.md'])
  })

  it('cuts very long mail short and points at the full copy', async () => {
    const dir = agentDir()
    writeFileSync(join(dir, 'inbox', '2-art.md'), 'x'.repeat(20000))
    const { code, stderr } = await run('watch', dir).done
    expect(code).toBe(2)
    expect(stderr.length).toBeLessThan(10000)
    expect(stderr).toContain('[... cut short, full text in')
  })

  it('a newer watcher replaces an older one', async () => {
    const dir = agentDir()
    const first = run('watch', dir)
    await new Promise((r) => setTimeout(r, 500))
    const second = run('watch', dir)
    expect((await first.done).code).toBe(0)
    second.kill()
  })
})
