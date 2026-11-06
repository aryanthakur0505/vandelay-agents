import { useEffect, useRef, useState } from 'react'
import { SYSTEM, YOU } from '@shared/ids'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { AgentForm } from './AgentForm'
import { AgentTerminal } from './AgentTerminal'
import { BootScreen } from './BootScreen'
import { CommsLog } from './CommsLog'
import { Composer } from './Composer'
import { FLIGHT_MS, Floor, type Flight } from './Floor'
import { beep, usePref } from './prefs'
import { WORKING_WINDOW_MS, type AgentStatus, type Theme } from './status'
import { StatusBar } from './StatusBar'
import { TermBar } from './TermBar'
import { UnitCards, type Traffic } from './UnitCards'

const APP_START = Date.now()

export function App(): React.JSX.Element {
  const [workspace, setWorkspace] = useState('')
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({})
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [flights, setFlights] = useState<Flight[]>([])
  const [log, setLog] = useState<HiveMessage[]>([])
  const [routed, setRouted] = useState(0)
  const [traffic, setTraffic] = useState<Record<string, Traffic>>({})
  const [generations, setGenerations] = useState<Record<string, number>>({})
  const [form, setForm] = useState<{ edit?: AgentConfig } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [theme, setTheme] = usePref<Theme>('theme', 'control')
  const [sound, setSound] = usePref<boolean>('sound', false)
  const [booting, setBooting] = useState(theme === 'control' && !matchMedia('(prefers-reduced-motion: reduce)').matches)

  const lastOutput = useRef<Record<string, number>>({})
  const upSince = useRef<Record<string, number>>({})
  const exited = useRef<Set<string>>(new Set())
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Unread mail in the title shows up in the taskbar while the window is in the background.
  const totalUnread = agents.reduce((n, a) => n + (unread[a.id] ?? 0), 0)
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) Vandelay Agents` : 'Vandelay Agents'
  }, [totalUnread])

  useEffect(() => {
    window.vandelay.workspace().then(setWorkspace)
    window.vandelay.listAgents().then((list) => {
      setAgents(list)
      setSelected(list[0]?.id ?? null)
    })
    const offRoster = window.vandelay.onRoster((list) => {
      setAgents(list)
      setSelected((s) => (s && list.some((a) => a.id === s) ? s : (list[0]?.id ?? null)))
    })
    const offData = window.vandelay.onData((id) => {
      lastOutput.current[id] = Date.now()
      upSince.current[id] ??= Date.now()
      exited.current.delete(id)
    })
    const offExit = window.vandelay.onExit((id) => {
      exited.current.add(id)
      delete upSince.current[id]
    })
    const offDelivered = window.vandelay.onDelivered((msg) => {
      setLog((l) => [msg, ...l].slice(0, 200))
      setRouted((n) => n + 1)
      setUnread((u) => ({ ...u, [msg.to]: (u[msg.to] ?? 0) + 1 }))
      // Notices from the app aren't work, so they don't count as the agent's latest task.
      const task = msg.from === SYSTEM ? undefined : msg.body.split('\n')[0]
      setTraffic((t) => ({
        ...t,
        [msg.from]: { ...t[msg.from], sent: (t[msg.from]?.sent ?? 0) + 1, received: t[msg.from]?.received ?? 0 },
        [msg.to]: { ...t[msg.to], sent: t[msg.to]?.sent ?? 0, received: (t[msg.to]?.received ?? 0) + 1, task: task ?? t[msg.to]?.task }
      }))
      setFlights((f) => [...f.filter((x) => Date.now() - x.start < FLIGHT_MS), { from: msg.from, to: msg.to, start: Date.now() }])
      if (soundRef.current) beep(msg.to === YOU ? 1320 : 880)
    })
    const tick = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setStatuses((prev) => {
        const next: Record<string, AgentStatus> = {}
        for (const id of Object.keys({ ...prev, ...lastOutput.current })) {
          if (exited.current.has(id)) next[id] = 'exited'
          else if (!lastOutput.current[id]) next[id] = 'starting'
          else next[id] = t - lastOutput.current[id] < WORKING_WINDOW_MS ? 'working' : 'idle'
        }
        return next
      })
    }, 400)
    return () => {
      offRoster()
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

  // Alt+1…9 jumps to an agent. Alt+digit means nothing to the agent CLIs, so terminals don't miss it.
  const agentsRef = useRef(agents)
  agentsRef.current = agents
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.altKey || e.ctrlKey || e.metaKey || !/^Digit[1-9]$/.test(e.code)) return
      const a = agentsRef.current[Number(e.code.slice(5)) - 1]
      if (!a) return
      e.preventDefault()
      e.stopPropagation()
      setSelected(a.id)
      setUnread((u) => ({ ...u, [a.id]: 0 }))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const restart = async (id: string): Promise<void> => {
    await window.vandelay.stopAgent(id)
    exited.current.delete(id)
    delete lastOutput.current[id]
    delete upSince.current[id]
    setGenerations((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }))
  }

  const fire = async (a: AgentConfig): Promise<void> => {
    if (!confirm(`Let ${a.name} go? Their terminal stops and their folder moves to .vandelay/former/.`)) return
    await window.vandelay.removeAgent(a.id)
  }

  const current = agents.find((a) => a.id === selected)
  const online = agents.filter((a) => {
    const s = statuses[a.id]
    return s === 'working' || s === 'idle'
  }).length

  return (
    <div className="app">
      {booting && <BootScreen agents={agents} onDone={() => setBooting(false)} />}

      <header>
        <div className="brand">
          <span className="logo">V</span>
          <div>
            <h1>
              Vandelay Agents{theme === 'control' && <span className="division"> // Robotics Division</span>}
            </h1>
            <small title="Choose another folder (restarts the app)">
              {workspace}{' '}
              <a href="#" onClick={(e) => (e.preventDefault(), window.vandelay.changeWorkspace())}>
                change
              </a>
            </small>
          </div>
        </div>
        <StatusBar online={online} total={agents.length} routed={routed} uptimeMs={now - APP_START} now={now} />
        <div className="header-actions">
          <button title="Sound on new messages" className={sound ? 'on' : ''} onClick={() => setSound(!sound)}>
            {sound ? 'Sound on' : 'Sound off'}
          </button>
          <button title="Switch theme" onClick={() => setTheme(theme === 'control' ? 'office' : 'control')}>
            {theme === 'control' ? 'Office theme' : 'Control room'}
          </button>
          <button className="primary" onClick={() => setForm({})}>
            + Hire
          </button>
        </div>
      </header>

      {form && (
        <AgentForm
          agent={form.edit}
          teamSize={agents.length}
          onCancel={() => setForm(null)}
          onSave={async (input) => {
            if (form.edit) await window.vandelay.updateAgent(form.edit.id, input)
            else select((await window.vandelay.addAgent(input)).id)
            setForm(null)
          }}
        />
      )}

      <main>
        <section className="left">
          <Floor agents={agents} statuses={statuses} unread={unread} flights={flights} selected={selected} theme={theme} onSelect={select} />
          <Composer agents={agents} defaultTo={agents.find((a) => a.orchestrator)?.id ?? agents[0]?.id ?? ''} />
          <CommsLog log={log} orchestratorName={agents.find((a) => a.orchestrator)?.name ?? 'the orchestrator'} />
        </section>

        <section className="right">
          <UnitCards
            agents={agents}
            statuses={statuses}
            unread={unread}
            traffic={traffic}
            upSince={upSince.current}
            now={now}
            selected={selected}
            theme={theme}
            onSelect={select}
          />
          {current && (
            <TermBar
              agent={current}
              task={traffic[current.id]?.task}
              onEdit={() => setForm({ edit: current })}
              onFire={() => fire(current)}
              onRestart={() => restart(current.id)}
              running={statuses[current.id] !== 'exited'}
              onStop={() => window.vandelay.stopAgent(current.id)}
            />
          )}
          <div className="terminals">
            {agents.map((a) => (
              <AgentTerminal key={a.id} agent={a} visible={a.id === selected} generation={generations[a.id] ?? 0} theme={theme} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
