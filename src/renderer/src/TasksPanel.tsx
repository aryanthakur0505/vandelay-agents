import type { HiveMessage } from '@shared/types'
import { addressLabel, ago } from './format'
import type { OpenTask } from './tasks'

interface Props {
  tasks: OpenTask[]
  /** Questions from agents that you haven't answered. */
  questions: HiveMessage[]
  now: number
  /** Show the agent a task waits on. */
  onSelect(id: string): void
  /** Point the composer at an agent who asked you something. */
  onReply(to: string): void
}

/** What's waiting: questions for you first, then briefs agents still owe a reply on. */
export function TasksPanel({ tasks, questions, now, onSelect, onReply }: Props): React.JSX.Element {
  return (
    <ul className="log tasks">
      {questions.map((q) => (
        <li key={q.id} className="to-you question">
          <span className="ts">[{ago(now - q.at)}]</span> <b>{addressLabel(q.from)}</b> asks <b>YOU</b>
          <button className="copy" onClick={() => onReply(q.from)} title={`Answer ${addressLabel(q.from)}`}>
            Reply
          </button>
          <p>{q.body}</p>
        </li>
      ))}
      {tasks.length === 0 && questions.length === 0 && <li className="muted">Nothing waiting. Every brief has had a reply.</li>}
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
