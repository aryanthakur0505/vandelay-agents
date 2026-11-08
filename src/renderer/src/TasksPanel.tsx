import { addressLabel, ago } from './format'
import type { OpenTask } from './tasks'

interface Props {
  tasks: OpenTask[]
  now: number
  /** Show the agent a task waits on. */
  onSelect(id: string): void
}

/** Briefs still waiting for a reply, oldest last, with who owes whom. */
export function TasksPanel({ tasks, now, onSelect }: Props): React.JSX.Element {
  return (
    <ul className="log tasks">
      {tasks.length === 0 && <li className="muted">Nothing waiting. Every brief has had a reply.</li>}
      {tasks.map((t) => (
        <li key={t.brief.id} title={t.brief.body}>
          <span className="ts">[{ago(now - t.brief.at)}]</span>{' '}
          <b className="who" onClick={() => onSelect(t.owner)} title={`Show ${addressLabel(t.owner)}'s terminal`}>
            {addressLabel(t.owner)}
          </b>{' '}
          <span className="muted">owes</span> <b>{addressLabel(t.requester)}</b>{' '}
          <span className="muted">{t.brief.body.split('\n')[0].slice(0, 80)}</span>
        </li>
      ))}
    </ul>
  )
}
