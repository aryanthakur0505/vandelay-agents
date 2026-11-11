import { useEffect, useMemo, useRef, useState } from 'react'
import { SYSTEM, YOU } from '@shared/ids'
import type { AgentConfig, HiveMessage, StuckMail } from '@shared/types'
import { AgentForm } from './AgentForm'
import { AgentTerminal } from './AgentTerminal'
import { BootScreen } from './BootScreen'
import { CommsLog, type CommsView } from './CommsLog'
import { Composer } from './Composer'
import { FLIGHT_MS, Floor, type Flight } from './Floor'
import { FONT_SIZE, nextFontSize } from './format'
import { useLatest } from './hooks'
import { beep, usePref } from './prefs'
import { WORKING_WINDOW_MS, type AgentStatus, type Theme } from './status'
import { SettingsPanel } from './SettingsPanel'
import { SetupCheck } from './SetupCheck'
import { StatusBar } from './StatusBar'
import { openTasks, pendingQuestions, taskCounts } from './tasks'
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
  const [form, setForm] = useState<{ edit?: AgentConfig; copyOf?: AgentConfig } | null>(null)
  const [aim, setAim] = useState<{ to: string; n: number }>()
  const [commsView, setCommsView] = useState<CommsView>('comms')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupSeen, setSetupSeen] = usePref<boolean>('setupSeen', false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [update, setUpdate] = useState<string | null>(null)
  useEffect(() => window.vandelay.onUpdateReady(setUpdate), [])
  // The checklist shows on the first run, and again whenever an essential tool goes missing.
  useEffect(() => {
    window.vandelay.setupStatus().then((s) => {
      if (!setupSeen || !s.claude || !s.node) setSetupOpen(true)
    })
    // Once per launch; later changes to setupSeen don't need a new check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [stuck, setStuck] = useState<StuckMail[]>([])
  useEffect(() => {
    const refresh = (): void => void window.vandelay.stuckMail().then(setStuck)
    refresh()
    return window.vandelay.onStuckChanged(refresh)
  }, [])
  const [now, setNow] = useState(() => Date.now())
  const [theme, setTheme] = usePref<Theme>('theme', 'control')
  const [sound, setSound] = usePref<boolean>('sound', false)
  const [fontSize, setFontSize] = usePref<number>('fontSize', FONT_SIZE.default)
  const [booting, setBooting] = useState(theme === 'control' && !matchMedia('(prefers-reduced-motion: reduce)').matches)

  const lastOutput = useRef<Record<string, number>>({})
  /** When each running agent first printed something. Rendered, so it is state; set once per run. */
  const [upSince, setUpSince] = useState<Record<string, number>>({})
  const dropUpSince = (id: string): void =>
    setUpSince((u) => {
      if (!(id in u)) return u
      const { [id]: _gone, ...rest } = u
      return rest
    })
  const exited = useRef<Set<string>>(new Set())
  const selectedRef = useLatest(selected)
  const soundRef = useLatest(sound)

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
    // Earlier traffic, so a restart doesn't wipe the log. Anything that arrived meanwhile stays on top.
    window.vandelay.history().then((past) => setLog((live) => [...live, ...past.filter((p) => !live.some((m) => m.id === p.id))].slice(0, 200)))
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
      // Returning the same object for agents already up keeps this from re-rendering per chunk.
      setUpSince((u) => (id in u ? u : { ...u, [id]: Date.now() }))
      exited.current.delete(id)
    })
    const offExit = window.vandelay.onExit((id) => {
      exited.current.add(id)
      dropUpSince(id)
    })
    const offDelivered = window.vandelay.onDelivered((msg) => {
      setLog((l) => [msg, ...l].slice(0, 200))
      setRouted((n) => n + 1)
      // Mail for the agent you're looking at isn't unread: you can see its terminal.
      if (msg.to !== selectedRef.current) setUnread((u) => ({ ...u, [msg.to]: (u[msg.to] ?? 0) + 1 }))
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
  }, [selectedRef, soundRef])

  const select = (id: string): void => {
    setSelected(id)
    setUnread((u) => ({ ...u, [id]: 0 }))
  }

  // Alt+1…9 jumps to an agent. Alt+digit means nothing to the agent CLIs, so terminals don't miss it.
  const agentsRef = useLatest(agents)
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
  }, [agentsRef])

  // Ctrl+Shift+K jumps to the composer and Ctrl+Shift+F to the comms search, terminals included (Ctrl+Shift is the usual
  // terminal-app modifier, so agent CLIs don't expect those keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey) return
      const target = e.code === 'KeyK' ? 'composer-input' : e.code === 'KeyF' ? 'comms-search' : null
      if (!target) return
      e.preventDefault()
      e.stopPropagation()
      document.getElementById(target)?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const restart = async (id: string): Promise<void> => {
    await window.vandelay.stopAgent(id)
    exited.current.delete(id)
    delete lastOutput.current[id]
    dropUpSince(id)
    setGenerations((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }))
  }

  const fire = async (a: AgentConfig): Promise<void> => {
    if (!confirm(`Let ${a.name} go? Their terminal stops and their folder moves to .vandelay/former/.`)) return
    await window.vandelay.removeAgent(a.id)
  }

  const current = agents.find((a) => a.id === selected)
  // The clock re-renders the app every 400ms; only the log changes what's open.
  const tasks = useMemo(() => openTasks(log), [log])
  const questions = useMemo(() => pendingQuestions(log), [log])
  const online = agents.filter((a) => {
    const s = statuses[a.id]
    return s === 'working' || s === 'idle'
  }).length

  return (
    <div className="app">
      {booting && <BootScreen agents={agents} onDone={() => setBooting(false)} />}

      <header>
        <div className="brand">
          <span className="logo" title={`Vandelay Agents v${__APP_VERSION__}`}>
            V
          </span>
          <div>
            <h1>Vandelay Agents{theme === 'control' && <span className="division"> // Robotics Division</span>}</h1>
            <small title="Choose another folder (restarts the app)">
              {workspace}{' '}
              <a href="#" onClick={(e) => (e.preventDefault(), window.vandelay.changeWorkspace())}>
                change
              </a>
            </small>
          </div>
        </div>
        <StatusBar
          online={online}
          total={agents.length}
          routed={routed}
          uptimeMs={now - APP_START}
          now={now}
          needsYou={questions.length}
          onNeedsYou={() => setCommsView('tasks')}
        />
        <div className="header-actions">
          <button title="Theme, text size, sound, team files" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button title="Switch theme" onClick={() => setTheme(theme === 'control' ? 'office' : 'control')}>
            {theme === 'control' ? 'Office theme' : 'Control room'}
          </button>
          <button className="primary" onClick={() => setForm({})}>
            + Hire
          </button>
        </div>
      </header>

      {update && (
        <div className="update-bar" role="status">
          Version {update} is ready. It installs when you quit, or now:
          <button className="primary" onClick={() => window.vandelay.installUpdate()} title="Stops the agents and restarts the app">
            Restart to update
          </button>
          <button onClick={() => setUpdate(null)}>Later</button>
        </div>
      )}

      {setupOpen && !booting && (
        <SetupCheck
          onClose={() => {
            setSetupOpen(false)
            setSetupSeen(true)
          }}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          onTheme={setTheme}
          sound={sound}
          onSound={setSound}
          fontSize={fontSize}
          onFontSize={setFontSize}
          agents={agents}
          onCheckSetup={() => {
            setSettingsOpen(false)
            setSetupOpen(true)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {form && (
        <AgentForm
          agent={form.edit}
          copyOf={form.copyOf}
          takenIds={agents.map((a) => a.id)}
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
          <Composer agents={agents} defaultTo={agents.find((a) => a.orchestrator)?.id ?? agents[0]?.id ?? ''} aim={aim} />
          <CommsLog
            log={log}
            agents={agents}
            workspace={workspace}
            onReply={(to) => setAim((a) => ({ to, n: (a?.n ?? 0) + 1 }))}
            tasks={tasks}
            questions={questions}
            stuck={stuck}
            view={commsView}
            onView={setCommsView}
            now={now}
            onSelect={select}
            orchestratorName={agents.find((a) => a.orchestrator)?.name ?? 'the orchestrator'}
          />
        </section>

        <section className="right">
          <UnitCards
            agents={agents}
            statuses={statuses}
            unread={unread}
            traffic={traffic}
            owed={taskCounts(tasks)}
            upSince={upSince}
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
              onClone={() => setForm({ copyOf: current })}
              onFire={() => fire(current)}
              onRestart={() => restart(current.id)}
              running={statuses[current.id] !== 'exited'}
              onStop={() => window.vandelay.stopAgent(current.id)}
            />
          )}
          <div className="terminals">
            {agents.map((a) => (
              <AgentTerminal
                key={a.id}
                agent={a}
                visible={a.id === selected}
                generation={generations[a.id] ?? 0}
                theme={theme}
                fontSize={fontSize}
                onZoom={(step) => setFontSize(nextFontSize(fontSize, step))}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
