import { useState } from 'react'
import { SYSTEM, YOU } from '@shared/ids'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { filterLog, NO_FILTER, type CommsFilter } from './commsFilter'
import { addressLabel, time } from './format'

interface Props {
  /** Newest first. */
  log: HiveMessage[]
  agents: AgentConfig[]
  orchestratorName: string
}

/** Every message the router delivered, with replies to you shown in full. */
export function CommsLog({ log, agents, orchestratorName }: Props): React.JSX.Element {
  const [filter, setFilter] = useState<CommsFilter>(NO_FILTER)
  const shown = filterLog(log, filter)
  const filtered = filter.party !== '' || filter.query.trim() !== ''

  return (
    <div className="comms">
      <div className="comms-bar">
        <span className="panel-title">Comms</span>
        <select value={filter.party} onChange={(e) => setFilter({ ...filter, party: e.target.value })} title="Only messages to or from">
          <option value="">Everyone</option>
          <option value={YOU}>You</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input type="search" value={filter.query} placeholder="Search" onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
      </div>
      <ul className="log">
        {log.length === 0 && <li className="muted">No traffic yet. Brief {orchestratorName} above.</li>}
        {log.length > 0 && shown.length === 0 && <li className="muted">Nothing matches.</li>}
        {shown.map((m) =>
          m.to === YOU ? (
            // Replies to the human are the point of the whole thing, so show them in full.
            <li key={m.file} className="to-you">
              <span className="ts">[{time(m.at)}]</span> <b>{addressLabel(m.from)}</b> ▸ <b>YOU</b>
              <button className="copy" title="Copy the reply" onClick={() => navigator.clipboard.writeText(m.body).catch(() => {})}>
                Copy
              </button>
              <p>{m.body}</p>
            </li>
          ) : (
            <li key={m.file} title={m.body} className={m.from === SYSTEM ? 'system' : ''}>
              <span className="ts">[{time(m.at)}]</span> <b>{addressLabel(m.from)}</b> ▸ <b>{addressLabel(m.to)}</b>{' '}
              <span className="muted">{m.body.slice(0, 90)}</span>
            </li>
          )
        )}
      </ul>
      {filtered && (
        <div className="comms-count muted">
          {shown.length} of {log.length}
        </div>
      )}
    </div>
  )
}
