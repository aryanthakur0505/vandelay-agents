import { EventEmitter } from 'node:events'
import { basename } from 'node:path'
import * as pty from 'node-pty'
import type { AgentConfig } from '@shared/types'

const SHELLS = new Set(['powershell', 'pwsh', 'cmd', 'bash', 'zsh', 'sh', 'fish', 'nu'])

/** Plain shells would try to run a nudge as a command, so we only nudge agent CLIs. */
export function isShell(command: string): boolean {
  return SHELLS.has(basename(command).toLowerCase().replace(/\.exe$/, ''))
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
      proc = pty.spawn(agent.command, agent.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: { ...process.env, ...env } as Record<string, string>
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
