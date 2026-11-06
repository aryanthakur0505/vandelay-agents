import type { AgentConfig } from '@shared/types'
import { clock } from './format'
import { STATUS_LABEL, statusColors, unitTag, type AgentStatus, type Theme } from './status'

export interface Traffic {
  sent: number
  received: number
  /** The latest thing this agent was asked to do. */
  task?: string
}

interface Props {
  agents: AgentConfig[]
  statuses: Record<string, AgentStatus>
  unread: Record<string, number>
  traffic: Record<string, Traffic>
  /** When each running agent first printed something. */
  upSince: Record<string, number>
  now: number
  selected: string | null
  theme: Theme
  onSelect(id: string): void
}

/** One card per agent: status light, unread count, uptime, model and message counts. */
export function UnitCards({ agents, statuses, unread, traffic, upSince, now, selected, theme, onSelect }: Props): React.JSX.Element {
  const colors = statusColors(theme)
  return (
    <nav className="units">
      {agents.map((a, i) => {
        const s = statuses[a.id] ?? 'starting'
        const t = traffic[a.id]
        return (
          <button
            key={a.id}
            className={a.id === selected ? 'unit active' : 'unit'}
            onClick={() => onSelect(a.id)}
            title={i < 9 ? `Alt+${i + 1}` : undefined}
            style={{ '--unit': a.color } as React.CSSProperties}
          >
            <span className="unit-head">
              <i style={{ background: colors[s], boxShadow: `0 0 6px ${colors[s]}` }} />
              <b>{a.name}</b>
              {(unread[a.id] ?? 0) > 0 && <em>{unread[a.id]}</em>}
            </span>
            <span className="unit-meta">
              {unitTag(i)} · {STATUS_LABEL[s]}
              {upSince[a.id] && s !== 'exited' ? ` · ${clock(now - upSince[a.id])}` : ''}
            </span>
            <span className="unit-meta">
              {a.orchestrator ? 'ORCHESTRATOR' : a.temp ? 'TEMP' : (a.model ?? 'default').toUpperCase()} · ↑{t?.sent ?? 0} ↓{t?.received ?? 0}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
