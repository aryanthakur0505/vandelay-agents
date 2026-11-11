import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** One log file, kept small: past MAX_BYTES it becomes `vandelay.old.log` and a new one starts. */
const MAX_BYTES = 1_000_000

let dir: string | null = null

/** Where logs go. Until this is called (and in tests) logging only reaches the console. */
export function initLog(logDir: string): string {
  mkdirSync(logDir, { recursive: true })
  dir = logDir
  return logFile(logDir)
}

export function logFile(logDir: string): string {
  return join(logDir, 'vandelay.log')
}

function write(level: 'info' | 'warn' | 'error', parts: unknown[]): void {
  const text = parts.map((p) => (p instanceof Error ? (p.stack ?? p.message) : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${text}\n`
  if (level === 'error') console.error(line.trimEnd())
  else console.log(line.trimEnd())
  if (!dir) return
  try {
    const file = logFile(dir)
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, join(dir, 'vandelay.old.log'))
    } catch {
      // No log yet.
    }
    appendFileSync(file, line)
  } catch {
    // A full disk shouldn't take the app down with it.
  }
}

export const log = {
  info: (...parts: unknown[]): void => write('info', parts),
  warn: (...parts: unknown[]): void => write('warn', parts),
  error: (...parts: unknown[]): void => write('error', parts)
}
