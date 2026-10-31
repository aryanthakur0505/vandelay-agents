import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { AgentConfig } from '@shared/types'
import hookScript from './hooks/claude-mail-hook.cjs?raw'
import { findExecutable } from './terminals'

/** One day: asyncRewake hooks keep their timeout, and the Stop hook re-arms the watcher anyway. */
const WATCH_TIMEOUT_S = 86400

export function isClaude(command: string): boolean {
  return basename(command).toLowerCase().replace(/\.(exe|cmd)$/, '') === 'claude'
}

/**
 * Claude agents get their mail through Claude Code hooks instead of typed prompts: a SessionStart
 * hook adds the agent's identity and the protocol to context, and an asyncRewake watcher (armed at
 * SessionStart and after every turn) wakes Claude when new mail lands in its inbox.
 * The hook also hands over the mail itself, so the agent only needs to write to its own folder.
 * Returns the extra CLI args, or null when Node isn't available to run the hook.
 */
export function claudeHookArgs(hiveRoot: string, agent: AgentConfig, agentDir: string): string[] | null {
  const node = findExecutable('node')
  if (!node) return null
  const script = join(hiveRoot, 'bin', 'claude-mail-hook.cjs')
  mkdirSync(join(hiveRoot, 'bin'), { recursive: true })
  writeFileSync(script, hookScript)

  const run = (mode: string, extra: object = {}): object => ({ type: 'command', command: node, args: [script, mode, agentDir], ...extra })
  const watch = run('watch', { asyncRewake: true, timeout: WATCH_TIMEOUT_S })
  const settings = {
    // Let the agent write in its own folder (outbox, memory) without a permission prompt. Claude Code
    // matches Windows paths in POSIX form, and `//` marks an absolute path.
    permissions: { allow: [`Edit(/${toPosix(agentDir)}/**)`] },
    hooks: {
      SessionStart: [{ hooks: [run('context'), watch] }],
      Stop: [{ hooks: [watch] }]
    }
  }
  const file = join(agentDir, 'claude-settings.json')
  writeFileSync(file, JSON.stringify(settings, null, 2))
  return ['--settings', file]
}

/**
 * Stops claude sessions left running for this agent, e.g. when the app was force-killed before it
 * could close its terminals. They are found by the agent's settings file on their command line,
 * which only Vandelay passes.
 */
export function stopOrphans(agentDir: string): Promise<void> {
  const file = join(agentDir, 'claude-settings.json')
  const [cmd, args] =
    process.platform === 'win32'
      ? [
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:VANDELAY_ORPHAN) } | ' +
              'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }'
          ]
        ]
      : ['pkill', ['-f', '--', file]]
  return new Promise((resolve) =>
    execFile(cmd, args, { env: { ...process.env, VANDELAY_ORPHAN: file }, windowsHide: true }, () => resolve())
  )
}

/** `D:\a\b` -> `/d/a/b`, the form Claude Code permission rules match on Windows. */
function toPosix(p: string): string {
  return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`)
}
