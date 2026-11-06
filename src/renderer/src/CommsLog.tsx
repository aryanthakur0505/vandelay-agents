import { SYSTEM, YOU } from '@shared/ids'
import type { HiveMessage } from '@shared/types'
import { addressLabel, time } from './format'

interface Props {
  /** Newest first. */
  log: HiveMessage[]
  orchestratorName: string
}

/** Every message the router delivered, with replies to you shown in full. */
export function CommsLog({ log, orchestratorName }: Props): React.JSX.Element {
  return (
    <div className="comms">
      <div className="panel-title">Comms</div>
      <ul className="log">
        {log.length === 0 && <li className="muted">No traffic yet. Brief {orchestratorName} above.</li>}
        {log.map((m) =>
          m.to === YOU ? (
            // Replies to the human are the point of the whole thing, so show them in full.
            <li key={m.file} className="to-you">
              <span className="ts">[{time(m.at)}]</span> <b>{addressLabel(m.from)}</b> ▸ <b>YOU</b>
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
    </div>
  )
}
