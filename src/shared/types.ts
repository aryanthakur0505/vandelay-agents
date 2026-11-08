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

/** What an edit may change: anything you chose when hiring, plus the color. */
export type AgentPatch = Partial<AgentInput> & { color?: string }

/** Mail the router couldn't or wouldn't deliver. */
export interface StuckMail {
  /** `held`: parked by the loop guard. `dead-letter`: unknown recipient or no `to:` line. */
  kind: 'held' | 'dead-letter'
  /** File name inside `.vandelay/<kind>/`. */
  file: string
  from: string
  to: string | null
  body: string
  at: number
}

export interface HiveMessage {
  id: string
  from: string
  to: string
  body: string
  file: string
  at: number
}

/** Files in an agent's hive folder you can open from the app. */
export type AgentFile = 'memory.md' | 'ROLE.md'

export interface VandelayApi {
  workspace(): Promise<string>
  /** Asks where to save, then writes the text there. Resolves to the path, or null if cancelled. */
  saveText(defaultName: string, text: string): Promise<string | null>
  /** Whether a command can be found on PATH (or at the path given), for the hire form. */
  commandExists(command: string): Promise<boolean>
  /** Pick another folder; the app restarts there. */
  changeWorkspace(): Promise<void>
  listAgents(): Promise<AgentConfig[]>
  addAgent(agent: AgentInput): Promise<AgentConfig>
  /** Changes apply the next time the agent starts. */
  updateAgent(id: string, patch: AgentPatch): Promise<AgentConfig>
  /**
   * Asks for a team file and hires everyone in it. Resolves to the agents hired, or null if you
   * cancelled; rejects with the reason when the file isn't a team.
   */
  importTeam(): Promise<AgentConfig[] | null>
  /** Stops the agent and moves its folder to `.vandelay/former/`. */
  removeAgent(id: string): Promise<void>
  startAgent(id: string, cols: number, rows: number): Promise<void>
  stopAgent(id: string): Promise<void>
  /** Opens the agent's hive folder, or one of its files, with the system's default app. */
  openAgent(id: string, file?: AgentFile): Promise<void>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  sendMessage(to: string, body: string): Promise<void>
  /** Recent delivered messages, newest first, read from disk. */
  history(): Promise<HiveMessage[]>
  /** Mail held by the loop guard or dead-lettered, newest first. */
  stuckMail(): Promise<StuckMail[]>
  /** Delivers a stuck message now. Rejects if its recipient isn't on the team. */
  releaseStuck(kind: StuckMail['kind'], file: string): Promise<void>
  /** Moves a stuck message to `.vandelay/discarded/`. */
  discardStuck(kind: StuckMail['kind'], file: string): Promise<void>
  /** Whenever mail gets stuck, released or discarded. */
  onStuckChanged(cb: () => void): () => void
  /** The same brief to every agent. */
  broadcast(body: string): Promise<void>
  onData(cb: (id: string, data: string) => void): () => void
  onExit(cb: (id: string, code: number) => void): () => void
  onDelivered(cb: (msg: HiveMessage) => void): () => void
  /** The whole roster, whenever anyone is hired, edited or let go. */
  onRoster(cb: (agents: AgentConfig[]) => void): () => void
}
