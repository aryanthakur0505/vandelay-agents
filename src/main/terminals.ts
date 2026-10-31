import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { basename, delimiter, extname, isAbsolute, join } from 'node:path'
import * as pty from 'node-pty'
import type { AgentConfig } from '@shared/types'

const SHELLS = new Set(['powershell', 'pwsh', 'cmd', 'bash', 'zsh', 'sh', 'fish', 'nu'])

/** Plain shells would try to run a nudge as a command, so we only nudge agent CLIs. */
export function isShell(command: string): boolean {
  return SHELLS.has(basename(command).toLowerCase().replace(/\.exe$/, ''))
}

/**
 * ConPTY only launches real executables found by name, so on Windows we resolve the command
 * through PATH and PATHEXT ourselves and run .cmd/.bat shims (npm installs) through cmd.exe.
 */
export function resolveCommand(command: string, args: string[]): { file: string; args: string[] } {
  if (process.platform !== 'win32') return { file: command, args }
  const exts = extname(command) ? [''] : (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')
  const dirs = isAbsolute(command) ? [''] : (process.env.PATH || '').split(delimiter).filter(Boolean)
  for (const dir of dirs)
    for (const ext of exts) {
      const file = dir ? join(dir, command + ext) : command + ext
      if (!existsSync(file)) continue
      if (/\.(cmd|bat)$/i.test(file)) return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', file, ...args] }
      return { file, args }
    }
  return { file: command, args }
}

export function commandExists(command: string): boolean {
  if (process.platform === 'win32') return resolveCommand(command, []).file !== command
  return (process.env.PATH || '').split(delimiter).some((dir) => dir && existsSync(join(dir, command)))
}

// Variables a Claude Code host session sets for its own children. An agent CLI that inherits them
// thinks it is nested inside that session, so drop them when the app itself was started from one.
const HOST_SESSION_VAR = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_AGENT_SDK_.*|CLAUDE_CODE_.*|ANTHROPIC_BASE_URL)$/

export function agentBaseEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  if (env.CLAUDECODE || env.CLAUDE_CODE_DESKTOP_APP_VERSION)
    for (const key of Object.keys(env)) if (HOST_SESSION_VAR.test(key)) delete env[key]
  return env
}

export class Terminals extends EventEmitter {
  private ptys = new Map<string, pty.IPty>()

  isRunning(id: string): boolean {
    return this.ptys.has(id)
  }

  start(agent: AgentConfig, cwd: string, env: Record<string, string>, cols: number, rows: number): void {
    if (this.ptys.has(agent.id)) {
      this.resize(agent.id, cols, rows)
      return
    }
    let proc: pty.IPty
    try {
      const { file, args } = resolveCommand(agent.command, agent.args)
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
    proc.onData((data) => this.emit('data', agent.id, data))
    proc.onExit(({ exitCode }) => {
      if (this.ptys.get(agent.id) === proc) this.ptys.delete(agent.id)
      this.emit('exit', agent.id, exitCode)
    })
  }

  write(id: string, data: string): void {
    this.ptys.get(id)?.write(data)
  }

  /** Types a prompt into the agent CLI and presses Enter a beat later, as TUIs need. */
  nudge(id: string, text: string): void {
    const p = this.ptys.get(id)
    if (!p) return
    p.write(text)
    setTimeout(() => p.write('\r'), 150)
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
