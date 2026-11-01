export type AgentStatus = 'starting' | 'working' | 'idle' | 'exited'

/** Output within this window counts as "working". */
export const WORKING_WINDOW_MS = 1500

export type Theme = 'control' | 'office'

const OFFICE: Record<AgentStatus, string> = {
  starting: '#9a8f85',
  working: '#4caf50',
  idle: '#f3a712',
  exited: '#d9534f'
}

const CONTROL: Record<AgentStatus, string> = {
  starting: '#3fd0ff',
  working: '#39ff88',
  idle: '#ffb000',
  exited: '#ff4d5e'
}

export function statusColors(theme: Theme): Record<AgentStatus, string> {
  return theme === 'control' ? CONTROL : OFFICE
}

export const STATUS_LABEL: Record<AgentStatus, string> = {
  starting: 'BOOTING',
  working: 'ACTIVE',
  idle: 'STANDBY',
  exited: 'OFFLINE'
}

/** Colors for the agent terminals, per theme. */
export function terminalTheme(theme: Theme, cursor: string): Record<string, string> {
  return theme === 'control'
    ? { background: '#060b12', foreground: '#cfe8f5', cursor, selectionBackground: '#1d4a66' }
    : { background: '#141211', foreground: '#ece4d8', cursor }
}

export function unitTag(index: number): string {
  return `UNIT-${String(index + 1).padStart(2, '0')}`
}
