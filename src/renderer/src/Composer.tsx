import { useEffect, useRef, useState } from 'react'
import type { AgentConfig } from '@shared/types'
import { remember, step } from './briefHistory'
import { errorText } from './format'
import { usePref } from './prefs'

/** The composer's "To:" value for a broadcast; can't clash with an agent id, which has no `*`. */
const EVERYONE = '*'

interface Props {
  agents: AgentConfig[]
  /** Who a brief goes to until you pick someone else: usually the orchestrator. */
  defaultTo: string
  /** Set to point the composer at an agent and focus it; `n` changes on every request. */
  aim?: { to: string; n: number }
}

/** Where you brief the team: pick an agent, write, Ctrl+Enter. */
export function Composer({ agents, defaultTo, aim }: Props): React.JSX.Element {
  const [to, setTo] = useState('')
  // The draft survives a restart, like an unsent email.
  const [body, setBody] = usePref<string>('draft', '')
  const [history, setHistory] = usePref<string[]>('briefs', [])
  /** Which past brief is showing: -1 while writing a new one. */
  const [browsing, setBrowsing] = useState(-1)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!aim) return
    setTo(aim.to)
    box.current?.focus()
  }, [aim])
  const target = to === EVERYONE || agents.some((a) => a.id === to) ? to : defaultTo

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const send = async (): Promise<void> => {
    if (!body.trim() || !target || sending) return
    // One brief at a time, so a double Ctrl+Enter can't send it twice.
    setSending(true)
    setError('')
    try {
      if (target === EVERYONE) await window.vandelay.broadcast(body)
      else await window.vandelay.sendMessage(target, body)
      setHistory(remember(history, body))
      setBrowsing(-1)
      setBody('')
    } catch (err) {
      // The brief stays in the box, so nothing is lost.
      setError(`Not sent: ${errorText(err)}`)
    } finally {
      setSending(false)
    }
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
        id="composer-input"
        ref={box}
        value={body}
        placeholder={`Brief ${target === EVERYONE ? 'every agent' : (agents.find((a) => a.id === target)?.name ?? 'an agent')} (Ctrl+Enter to send)`}
        onChange={(e) => {
          setBody(e.target.value)
          setBrowsing(-1)
          setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return void send()
          // Up and Down recall earlier briefs, like a shell, but only while the box is empty or still
          // showing a recalled brief, so they keep moving the caret in anything you are writing.
          const arrow = e.key === 'ArrowUp' ? 'older' : e.key === 'ArrowDown' ? 'newer' : null
          if (!arrow || (body !== '' && browsing === -1)) return
          e.preventDefault()
          const next = step(history, browsing, arrow)
          setBrowsing(next)
          setBody(next === -1 ? '' : history[next])
        }}
      />
      <button className="primary" onClick={send} disabled={!body.trim() || sending}>
        Send
      </button>
      {error && <p className="composer-error">{error}</p>}
    </div>
  )
}
