import type { AgentConfig, AgentInput, Autonomy } from './types'

/** A team saved to share or reuse in another workspace: the hires, without ids, colors or folders. */
export interface TeamFile {
  vandelayTeam: 1
  agents: AgentInput[]
}

const AUTONOMIES: Autonomy[] = ['inherit', 'read-only', 'ask', 'edits', 'auto']

/** Everyone but the orchestrator (each workspace has its own) and temps (hired for one job). */
export function teamFile(agents: AgentConfig[]): string {
  const team: TeamFile = {
    vandelayTeam: 1,
    agents: agents
      .filter((a) => !a.orchestrator && !a.temp)
      .map(({ name, command, args, cwd, role, model, autonomy, worktree }) => ({ name, command, args, cwd, role, model, autonomy, worktree }))
  }
  return JSON.stringify(team, null, 2) + '\n'
}

/** Reads a team file back, keeping only fields a hire may set. Throws with a readable reason. */
export function parseTeamFile(text: string): AgentInput[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't JSON.")
  }
  const team = data as Partial<TeamFile>
  if (team?.vandelayTeam !== 1 || !Array.isArray(team.agents)) throw new Error("That isn't a Vandelay team file.")
  return team.agents.map((raw, i) => {
    const a = raw as Partial<AgentInput>
    if (typeof a?.name !== 'string' || !a.name.trim()) throw new Error(`Agent ${i + 1} has no name.`)
    if (typeof a.command !== 'string' || !a.command.trim()) throw new Error(`${a.name} has no command.`)
    return {
      name: a.name.trim(),
      command: a.command.trim(),
      args: Array.isArray(a.args) ? a.args.filter((x): x is string => typeof x === 'string') : [],
      cwd: typeof a.cwd === 'string' ? a.cwd : '',
      ...(typeof a.role === 'string' && { role: a.role }),
      ...(typeof a.model === 'string' && { model: a.model }),
      ...(AUTONOMIES.includes(a.autonomy as Autonomy) && { autonomy: a.autonomy }),
      ...(a.worktree === true && { worktree: true })
    }
  })
}
