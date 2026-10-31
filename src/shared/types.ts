export interface AgentConfig {
  /** Short lowercase id, also the hive folder name. */
  id: string
  name: string
  /** Executable to run in the PTY, e.g. `claude`, `codex`, `powershell.exe`. */
  command: string
  args: string[]
  /** Working directory. Empty means the workspace root. */
  cwd: string
  color: string
  /** The orchestrator routes work to the others. Exactly one agent has this. */
  orchestrator?: boolean
  /** Work in a git worktree of its own, on branch `vandelay/<id>`, instead of the shared folder. */
  worktree?: boolean
}

export interface HiveMessage {
  id: string
  from: string
  to: string
  body: string
  file: string
  at: number
}

export interface VandelayApi {
  workspace(): Promise<string>
  /** Pick another folder; the app restarts there. */
  changeWorkspace(): Promise<void>
  listAgents(): Promise<AgentConfig[]>
  addAgent(agent: Omit<AgentConfig, 'id' | 'color'>): Promise<AgentConfig>
  startAgent(id: string, cols: number, rows: number): Promise<void>
  stopAgent(id: string): Promise<void>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  sendMessage(to: string, body: string): Promise<void>
  onData(cb: (id: string, data: string) => void): () => void
  onExit(cb: (id: string, code: number) => void): () => void
  onDelivered(cb: (msg: HiveMessage) => void): () => void
}
