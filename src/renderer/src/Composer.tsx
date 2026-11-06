import { useState } from 'react'
import type { AgentConfig } from '@shared/types'

/** The composer's "To:" value for a broadcast; can't clash with an agent id, which has no `*`. */
const EVERYONE = '*'

interface Props {
  agents: AgentConfig[]
  /** Who a brief goes to until you pick someone else: usually the orchestrator. */
  defaultTo: string
}

/** Where you brief the team: pick an agent, write, Ctrl+Enter. */
export function Composer({ agents, defaultTo }: Props): React.JSX.Element {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const target = to === EVERYONE || agents.some((a) => a.id === to) ? to : defaultTo

  const send = async (): Promise<void> => {
    if (!body.trim() || !target) return
    if (target === EVERYONE) await window.vandelay.broadcast(body)
    else await window.vandelay.sendMessage(target, body)
    setBody('')
  }

  return (
    <div className="composer">
      <select value={target} onChange={(e) => setTo(e.target.value)}>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            To: {a.name}
          </option>
        ))}
        {agents.length > 1 && <option value={EVERYONE}>To: Everyone</option>}
      </select>
      <textarea
        value={body}
        placeholder={`Brief ${target === EVERYONE ? 'every agent' : (agents.find((a) => a.id === target)?.name ?? 'an agent')} (Ctrl+Enter to send)`}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
        }}
      />
      <button className="primary" onClick={send} disabled={!body.trim()}>
        Send
      </button>
    </div>
  )
}
