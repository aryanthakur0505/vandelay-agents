/**
 * How much a claude agent may do without asking, mapped to Claude Code's `--permission-mode`.
 * `inherit` passes nothing, so the agent uses your own Claude Code default.
 */
export type Autonomy = 'inherit' | 'read-only' | 'ask' | 'edits' | 'auto'

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
  /** What the agent is good at, in a sentence or two. The orchestrator routes work by it. */
  role?: string
  /** Model alias or name for claude agents (`opus`, `sonnet`, `haiku`, …). Empty means your default. */
  model?: string
  autonomy?: Autonomy
  /** A short-lived agent the orchestrator hired for one job. */
  temp?: boolean
  /** Who hired a temp. */
  hiredBy?: string
}

/** Everything about an agent you choose when hiring; the hive picks the id and color. */
export type AgentInput = Omit<AgentConfig, 'id' | 'color'>

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
  addAgent(agent: AgentInput): Promise<AgentConfig>
  /** Changes apply the next time the agent starts. */
  updateAgent(id: string, patch: Partial<AgentInput>): Promise<AgentConfig>
  /** Stops the agent and moves its folder to `.vandelay/former/`. */
  removeAgent(id: string): Promise<void>
  startAgent(id: string, cols: number, rows: number): Promise<void>
  stopAgent(id: string): Promise<void>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  sendMessage(to: string, body: string): Promise<void>
  onData(cb: (id: string, data: string) => void): () => void
  onExit(cb: (id: string, code: number) => void): () => void
  onDelivered(cb: (msg: HiveMessage) => void): () => void
  /** The whole roster, whenever anyone is hired, edited or let go. */
  onRoster(cb: (agents: AgentConfig[]) => void): () => void
}
