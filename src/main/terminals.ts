import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { basename, delimiter, extname, isAbsolute, join } from 'node:path'
import * as pty from 'node-pty'
import type { AgentConfig } from '@shared/types'

const SHELLS = new Set(['powershell', 'pwsh', 'cmd', 'bash', 'zsh', 'sh', 'fish', 'nu'])

/** Plain shells would try to run a nudge as a command, so we only nudge agent CLIs. */
export function isShell(command: string): boolean {
  return SHELLS.has(
    basename(command)
      .toLowerCase()
      .replace(/\.exe$/, '')
  )
}

/** Full path of a command found through PATH (and PATHEXT on Windows), or null. */
export function findExecutable(command: string): string | null {
  const win = process.platform === 'win32'
  const exts = win && !extname(command) ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : ['']
  const dirs = isAbsolute(command) ? [''] : (process.env.PATH || '').split(delimiter).filter(Boolean)
  for (const dir of dirs)
    for (const ext of exts) {
      const file = dir ? join(dir, command + ext) : command + ext
      if (existsSync(file)) return file
    }
  return null
}

/**
 * ConPTY only launches real executables found by name, so on Windows we resolve the command
 * ourselves and run .cmd/.bat shims (npm installs) through cmd.exe.
 */
export function resolveCommand(command: string, args: string[]): { file: string; args: string[] } {
  if (process.platform !== 'win32') return { file: command, args }
  const file = findExecutable(command)
  if (!file) return { file: command, args }
  if (/\.(cmd|bat)$/i.test(file)) return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', file, ...args] }
  return { file, args }
}

// Variables a Claude Code host session sets for its own children. An agent CLI that inherits them
// thinks it is nested inside that session, so drop them when the app itself was started from one.
const HOST_SESSION_VAR = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_AGENT_SDK_.*|CLAUDE_CODE_.*|ANTHROPIC_BASE_URL)$/

export function agentBaseEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  if (env.CLAUDECODE || env.CLAUDE_CODE_DESKTOP_APP_VERSION) for (const key of Object.keys(env)) if (HOST_SESSION_VAR.test(key)) delete env[key]
  return env
}

const QUIET_MS = 2000

export class Terminals extends EventEmitter {
  private ptys = new Map<string, pty.IPty>()
  private lastOutput = new Map<string, number>()
  private pending = new Map<string, string>()
  private flushTimer: NodeJS.Timeout | null = null

  isRunning(id: string): boolean {
    return this.ptys.has(id)
  }

  start(agent: AgentConfig, cwd: string, env: Record<string, string>, cols: number, rows: number, extraArgs: string[] = []): void {
    if (this.ptys.has(agent.id)) {
      this.resize(agent.id, cols, rows)
      return
    }
    let proc: pty.IPty
    try {
      const { file, args } = resolveCommand(agent.command, [...agent.args, ...extraArgs])
      proc = pty.spawn(file, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: { ...agentBaseEnv(), ...env }
      })
    } catch (err) {
      this.emit('data', agent.id, `\r\n\x1b[31mCould not start "${agent.command}": ${(err as Error).message}\x1b[0m\r\n`)
      this.emit('exit', agent.id, -1)
      return
    }
    this.ptys.set(agent.id, proc)
    proc.onData((data) => {
      this.lastOutput.set(agent.id, Date.now())
      this.emit('data', agent.id, data)
    })
    proc.onExit(({ exitCode }) => {
      if (this.ptys.get(agent.id) === proc) this.ptys.delete(agent.id)
      this.emit('exit', agent.id, exitCode)
    })
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.write(data)
  }

  /**
   * Queues a prompt for the agent CLI. A TUI drops input that arrives while it is busy or still
   * starting, so the prompt waits until the terminal has been quiet for QUIET_MS. A newer nudge for
   * the same agent replaces a pending one, so a burst of mail becomes one prompt.
   */
  nudge(id: string, text: string): void {
    this.pending.set(id, text)
    this.flushTimer ??= setInterval(() => this.flushNudges(), 250)
  }

  private flushNudges(): void {
    for (const [id, text] of this.pending) {
      const p = this.ptys.get(id)
      if (!p) {
        this.pending.delete(id)
        continue
      }
      if (Date.now() - (this.lastOutput.get(id) ?? 0) < QUIET_MS) continue
      this.pending.delete(id)
      p.write(text)
      // Enter a beat later, or the TUI treats it as part of a paste.
      setTimeout(() => p.write('\r'), 150)
    }
    if (this.pending.size === 0 && this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }

  resize(id: string, cols: number, rows: number): void {
    try {
      this.ptys.get(id)?.resize(Math.max(cols, 2), Math.max(rows, 2))
    } catch {
      // The process may have exited between the check and the call.
    }
  }

  stop(id: string): void {
    const p = this.ptys.get(id)
    if (!p) return
    this.ptys.delete(id)
    p.kill()
  }

  stopAll(): void {
    for (const id of [...this.ptys.keys()]) this.stop(id)
  }
}
