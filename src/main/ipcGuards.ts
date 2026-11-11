import type { AgentInput, AgentPatch, Autonomy } from '@shared/types'

/**
 * Checks for values arriving over IPC. The renderer is our own code, but it renders text agents and
 * files produce, so the main process treats whatever it sends as untrusted: right type, sane size.
 */

const MAX_TEXT = 1_000_000

export function text(value: unknown, name: string, max = MAX_TEXT): string {
  if (typeof value !== 'string') throw new Error(`${name} must be text`)
  if (value.length > max) throw new Error(`${name} is too long`)
  return value
}

export function int(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${name} is out of range`)
  return value
}

export function oneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error(`${name} must be one of ${allowed.join(', ')}`)
  return value as T
}

const AUTONOMIES: readonly Autonomy[] = ['inherit', 'read-only', 'ask', 'edits', 'auto']

function optionalText(o: Record<string, unknown>, key: string): string | undefined {
  return o[key] === undefined ? undefined : text(o[key], key, 10_000)
}

/** The fields a hire or an edit may carry, each checked; anything else is dropped. */
export function agentPatch(value: unknown): AgentPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Agent details must be an object')
  const o = value as Record<string, unknown>
  const patch: AgentPatch = {}
  for (const key of ['name', 'command', 'cwd', 'role', 'model', 'color'] as const) {
    const v = optionalText(o, key)
    if (v !== undefined) patch[key] = v
  }
  if (o.args !== undefined) {
    if (!Array.isArray(o.args)) throw new Error('args must be a list')
    patch.args = o.args.map((a, i) => text(a, `args[${i}]`, 10_000))
  }
  if (o.autonomy !== undefined) patch.autonomy = oneOf(o.autonomy, 'autonomy', AUTONOMIES)
  if (o.worktree !== undefined) patch.worktree = o.worktree === true
  return patch
}

/** A whole hire: an edit's fields, with name and command required. */
export function agentInput(value: unknown): AgentInput {
  const patch = agentPatch(value)
  if (patch.name === undefined || patch.command === undefined) throw new Error('A hire needs a name and a command')
  const { color: _color, ...input } = patch
  return { ...input, name: patch.name, command: patch.command, args: patch.args ?? [], cwd: patch.cwd ?? '' }
}
