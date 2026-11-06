import { useState } from 'react'
import type { AgentConfig } from '@shared/types'

interface Props {
  agents: AgentConfig[]
  /** Who a brief goes to until you pick someone else: usually the orchestrator. */
  defaultTo: string
}

/** Where you brief the team: pick an agent, write, Ctrl+Enter. */
export function Composer({ agents, defaultTo }: Props): React.JSX.Element {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const target = agents.some((a) => a.id === to) ? to : defaultTo

  const send = async (): Promise<void> => {
    if (!body.trim() || !target) return
    await window.vandelay.sendMessage(target, body)
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
      </select>
      <textarea
        value={body}
        placeholder={`Brief ${agents.find((a) => a.id === target)?.name ?? 'an agent'} (Ctrl+Enter to send)`}
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
