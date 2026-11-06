import type { HiveMessage } from '@shared/types'
import { addressLabel } from './format'

/** The log as a Markdown transcript, oldest first, the way you'd read it back later. */
export function commsMarkdown(log: HiveMessage[], workspace: string): string {
  const lines = [`# Vandelay Agents comms`, '', `Workspace: \`${workspace}\``, '']
  for (const m of [...log].sort((a, b) => a.at - b.at)) {
    lines.push(`## ${new Date(m.at).toISOString()} · ${addressLabel(m.from)} → ${addressLabel(m.to)}`, '', m.body, '')
  }
  return lines.join('\n')
}

/** `vandelay-comms-2026-11-06-1430.md`, for the save dialog. */
export function commsFileName(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `vandelay-comms-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.md`
}
