import type { AgentConfig } from '@shared/types'

interface Props {
  agent: AgentConfig
  /** The latest thing the agent was asked to do, if anything. */
  task?: string
  onEdit(): void
  onFire(): void
  onRestart(): void
}

/** What the selected agent runs and does, with its controls. */
export function TermBar({ agent, task, onEdit, onFire, onRestart }: Props): React.JSX.Element {
  return (
    <div className="term-bar">
      <div className="term-info">
        <code>
          {agent.command} {agent.args.join(' ')}
          {agent.model && <span className="muted"> · {agent.model}</span>}
          {agent.autonomy && agent.autonomy !== 'inherit' && <span className="muted"> · {agent.autonomy}</span>}
          {agent.worktree && <span className="muted"> · worktree vandelay/{agent.id}</span>}
        </code>
        <span className="role" title={agent.role}>
          {agent.orchestrator ? 'Orchestrator: routes your briefs to the team.' : agent.role || 'No specialty set.'}
        </span>
        {task && <span className="task">Last task: {task}</span>}
      </div>
      <button onClick={onEdit}>Edit</button>
      {!agent.orchestrator && <button onClick={onFire}>Let go</button>}
      <button onClick={onRestart}>Restart</button>
    </div>
  )
}
