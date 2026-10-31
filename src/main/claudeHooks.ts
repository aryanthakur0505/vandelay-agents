import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
 * Returns the extra CLI args, or null when Node isn't available to run the hook.
 */
export function claudeHookArgs(hiveRoot: string, agent: AgentConfig, agentDir: string): string[] | null {
  const node = findExecutable('node')
  if (!node) return null
  const script = join(hiveRoot, 'bin', 'claude-mail-hook.cjs')
  mkdirSync(join(hiveRoot, 'bin'), { recursive: true })
  writeFileSync(script, hookScript)
  // A new session should hear about everything already waiting.
  rmSync(join(agentDir, '.notified'), { force: true })

  const run = (mode: string, extra: object = {}): object => ({ type: 'command', command: node, args: [script, mode, agentDir], ...extra })
  const watch = run('watch', { asyncRewake: true, timeout: WATCH_TIMEOUT_S })
  const settings = {
    hooks: {
      SessionStart: [{ hooks: [run('context'), watch] }],
      Stop: [{ hooks: [watch] }]
    }
  }
  const file = join(agentDir, 'claude-settings.json')
  writeFileSync(file, JSON.stringify(settings, null, 2))
  return ['--settings', file]
}
