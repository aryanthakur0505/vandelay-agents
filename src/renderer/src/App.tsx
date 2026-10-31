import { useEffect, useRef, useState } from 'react'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { AgentTerminal } from './AgentTerminal'
import { FLIGHT_MS, Floor, type Flight } from './Floor'
import { STATUS_COLOR, WORKING_WINDOW_MS, type AgentStatus } from './status'

export function App(): React.JSX.Element {
  const [workspace, setWorkspace] = useState('')
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({})
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [flights, setFlights] = useState<Flight[]>([])
  const [log, setLog] = useState<HiveMessage[]>([])
  const [generations, setGenerations] = useState<Record<string, number>>({})
  const [adding, setAdding] = useState(false)

  const lastOutput = useRef<Record<string, number>>({})
  const exited = useRef<Set<string>>(new Set())

  useEffect(() => {
    window.vandelay.workspace().then(setWorkspace)
    window.vandelay.listAgents().then((list) => {
      setAgents(list)
      setSelected(list[0]?.id ?? null)
    })
    const offData = window.vandelay.onData((id) => {
      lastOutput.current[id] = Date.now()
      exited.current.delete(id)
    })
    const offExit = window.vandelay.onExit((id) => exited.current.add(id))
    const offDelivered = window.vandelay.onDelivered((msg) => {
      setLog((l) => [msg, ...l].slice(0, 50))
      setUnread((u) => ({ ...u, [msg.to]: (u[msg.to] ?? 0) + 1 }))
      setFlights((f) => [...f.filter((x) => Date.now() - x.start < FLIGHT_MS), { from: msg.from, to: msg.to, start: Date.now() }])
    })
    const tick = setInterval(() => {
      const now = Date.now()
      setStatuses((prev) => {
        const next: Record<string, AgentStatus> = {}
        for (const id of Object.keys({ ...prev, ...lastOutput.current })) {
          if (exited.current.has(id)) next[id] = 'exited'
          else if (!lastOutput.current[id]) next[id] = 'starting'
          else next[id] = now - lastOutput.current[id] < WORKING_WINDOW_MS ? 'working' : 'idle'
        }
        return next
      })
    }, 400)
    return () => {
      offData()
      offExit()
      offDelivered()
      clearInterval(tick)
    }
  }, [])

  const select = (id: string): void => {
    setSelected(id)
    setUnread((u) => ({ ...u, [id]: 0 }))
  }

  const restart = async (id: string): Promise<void> => {
    await window.vandelay.stopAgent(id)
    exited.current.delete(id)
    delete lastOutput.current[id]
    setGenerations((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }))
  }

  const current = agents.find((a) => a.id === selected)

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">V</span>
          <div>
            <h1>Vandelay Agents</h1>
            <small title="Choose another folder (restarts the app)">
              {workspace}{' '}
              <a href="#" onClick={(e) => (e.preventDefault(), window.vandelay.changeWorkspace())}>
                change
              </a>
            </small>
          </div>
        </div>
        <button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add agent'}</button>
      </header>

      {adding && (
        <AddAgentForm
          onAdd={async (input) => {
            const agent = await window.vandelay.addAgent(input)
            setAgents((a) => [...a, agent])
            select(agent.id)
            setAdding(false)
          }}
        />
      )}

      <main>
        <section className="left">
          <Floor agents={agents} statuses={statuses} unread={unread} flights={flights} selected={selected} onSelect={select} />
          <Composer agents={agents} defaultTo={agents.find((a) => a.orchestrator)?.id ?? agents[0]?.id ?? ''} />
          <ul className="log">
            {log.length === 0 && <li className="muted">No messages yet. Brief Art Vandelay above.</li>}
            {log.map((m) =>
              m.to === 'you' ? (
                // Replies to the human are the point of the whole thing, so show them in full.
                <li key={m.file} className="to-you">
                  <b>{m.from}</b> → <b>you</b>
                  <p>{m.body}</p>
                </li>
              ) : (
                <li key={m.file} title={m.body}>
                  <b>{m.from}</b> → <b>{m.to}</b> <span className="muted">{m.body.slice(0, 80)}</span>
                </li>
              )
            )}
          </ul>
        </section>

        <section className="right">
          <nav className="tabs">
            {agents.map((a) => (
              <button key={a.id} className={a.id === selected ? 'tab active' : 'tab'} onClick={() => select(a.id)}>
                <i style={{ background: STATUS_COLOR[statuses[a.id] ?? 'starting'] }} />
                {a.name}
                {(unread[a.id] ?? 0) > 0 && <em>{unread[a.id]}</em>}
              </button>
            ))}
          </nav>
          {current && (
            <div className="term-bar">
              <code>
                {current.command} {current.args.join(' ')}
                {current.worktree && <span className="muted"> · worktree vandelay/{current.id}</span>}
              </code>
              <button onClick={() => restart(current.id)}>Restart</button>
            </div>
          )}
          <div className="terminals">
            {agents.map((a) => (
              <AgentTerminal key={a.id} agent={a} visible={a.id === selected} generation={generations[a.id] ?? 0} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function Composer({ agents, defaultTo }: { agents: AgentConfig[]; defaultTo: string }): React.JSX.Element {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')
  const target = to || defaultTo

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
        placeholder="Write a message to drop in their inbox (Ctrl+Enter to send)"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
        }}
      />
      <button onClick={send} disabled={!body.trim()}>
        Send
      </button>
    </div>
  )
}

function AddAgentForm({ onAdd }: { onAdd(input: Omit<AgentConfig, 'id' | 'color'>): void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('claude')
  const [cwd, setCwd] = useState('')
  const [worktree, setWorktree] = useState(false)

  return (
    <form
      className="add-agent"
      onSubmit={(e) => {
        e.preventDefault()
        const [cmd, ...args] = command.trim().split(/\s+/)
        if (name.trim() && cmd) onAdd({ name: name.trim(), command: cmd, args, cwd: cwd.trim(), ...(worktree && { worktree }) })
      }}
    >
      <input autoFocus placeholder="Name (e.g. George)" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Command (claude, codex, gemini, powershell.exe…)" value={command} onChange={(e) => setCommand(e.target.value)} />
      <input placeholder="Working folder (blank = workspace)" value={cwd} onChange={(e) => setCwd(e.target.value)} />
      <label title="Work on branch vandelay/<id> in a git worktree of its own, so it can't overwrite other agents' edits">
        <input type="checkbox" checked={worktree} onChange={(e) => setWorktree(e.target.checked)} /> Own git worktree
      </label>
      <button type="submit">Hire</button>
    </form>
  )
}
