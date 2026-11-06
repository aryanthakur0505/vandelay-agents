import { useState } from 'react'
import { SYSTEM, YOU } from '@shared/ids'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { commsFileName, commsMarkdown } from './commsExport'
import { filterLog, NO_FILTER, type CommsFilter } from './commsFilter'
import { addressLabel, time } from './format'

interface Props {
  /** Newest first. */
  log: HiveMessage[]
  agents: AgentConfig[]
  workspace: string
  orchestratorName: string
  /** Point the composer at whoever sent a message. */
  onReply(to: string): void
}

/** Every message the router delivered, with replies to you shown in full. */
export function CommsLog({ log, agents, workspace, orchestratorName, onReply }: Props): React.JSX.Element {
  const [filter, setFilter] = useState<CommsFilter>(NO_FILTER)
  const shown = filterLog(log, filter)
  const filtered = filter.party !== '' || filter.query.trim() !== ''
  /** A name in the log: click it to see only that party's traffic. */
  const who = (id: string): React.JSX.Element => (
    <b className="who" title={`Only ${addressLabel(id)}'s messages`} onClick={() => setFilter({ ...filter, party: id })}>
      {addressLabel(id)}
    </b>
  )

  return (
    <div className="comms">
      <div className="comms-bar">
        <span className="panel-title">Comms</span>
        <select value={filter.party} onChange={(e) => setFilter({ ...filter, party: e.target.value })} title="Only messages to or from">
          <option value="">Everyone</option>
          <option value={YOU}>You</option>
          <option value={SYSTEM}>App notices</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          id="comms-search"
          type="search"
          value={filter.query}
          placeholder="Search"
          onChange={(e) => setFilter({ ...filter, query: e.target.value })}
        />
        <button
          disabled={shown.length === 0}
          title="Save the messages shown as a Markdown file"
          onClick={() => window.vandelay.saveText(commsFileName(), commsMarkdown(shown, workspace))}
        >
          Export
        </button>
      </div>
      <ul className="log">
        {log.length === 0 && <li className="muted">No traffic yet. Brief {orchestratorName} above.</li>}
        {log.length > 0 && shown.length === 0 && <li className="muted">Nothing matches.</li>}
        {shown.map((m) =>
          m.to === YOU ? (
            // Replies to the human are the point of the whole thing, so show them in full.
            <li key={m.file} className="to-you">
              <span className="ts">[{time(m.at)}]</span> {who(m.from)} ▸ <b>YOU</b>
              <button className="copy" title="Copy the reply" onClick={() => navigator.clipboard.writeText(m.body).catch(() => {})}>
                Copy
              </button>
              {agents.some((a) => a.id === m.from) && (
                <button className="copy" title={`Brief ${m.from} next`} onClick={() => onReply(m.from)}>
                  Reply
                </button>
              )}
              <p>{m.body}</p>
            </li>
          ) : (
            <li key={m.file} title={m.body} className={m.from === SYSTEM ? 'system' : ''}>
              <span className="ts">[{time(m.at)}]</span> {who(m.from)} ▸ {who(m.to)} <span className="muted">{m.body.slice(0, 90)}</span>
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
