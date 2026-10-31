export type AgentStatus = 'starting' | 'working' | 'idle' | 'exited'

/** Output within this window counts as "working". */
export const WORKING_WINDOW_MS = 1500

export const STATUS_COLOR: Record<AgentStatus, string> = {
  starting: '#9a8f85',
  working: '#4caf50',
  idle: '#f3a712',
  exited: '#d9534f'
}
