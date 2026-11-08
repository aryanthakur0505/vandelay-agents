import { useState } from 'react'
import type { StuckMail } from '@shared/types'
import { addressLabel, ago, errorText } from './format'

interface Props {
  mail: StuckMail[]
  now: number
}

const WHY: Record<StuckMail['kind'], string> = {
  held: 'held by the loop guard',
  'dead-letter': 'no such recipient'
}

/** Mail the router held or couldn't deliver, with a way to send it anyway or put it aside. */
export function StuckPanel({ mail, now }: Props): React.JSX.Element {
  const [error, setError] = useState('')
  const act = (run: () => Promise<void>): void => {
    setError('')
    run().catch((err) => setError(errorText(err)))
  }

  return (
    <ul className="log stuck">
      {error && <li className="composer-error">{error}</li>}
      {mail.length === 0 && <li className="muted">No stuck mail. Everything was delivered.</li>}
      {mail.map((m) => (
        <li key={`${m.kind}/${m.file}`} className="to-you stuck-item">
          <span className="ts">[{ago(now - m.at)}]</span> <b>{addressLabel(m.from)}</b> ▸ <b>{m.to ? addressLabel(m.to) : '?'}</b>{' '}
          <span className="muted">{WHY[m.kind]}</span>
          <button className="copy" title="Put it in .vandelay/discarded/" onClick={() => act(() => window.vandelay.discardStuck(m.kind, m.file))}>
            Discard
          </button>
          {m.to && (
            <button className="copy" title="Deliver it now" onClick={() => act(() => window.vandelay.releaseStuck(m.kind, m.file))}>
              Deliver
            </button>
          )}
          <p>{m.body.slice(0, 400)}</p>
        </li>
      ))}
    </ul>
  )
}
