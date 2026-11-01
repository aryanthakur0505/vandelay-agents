import { useEffect, useRef, useState } from 'react'
import type { AgentConfig } from '@shared/types'
import { unitTag } from './status'

const STEP_MS = 140

/** A short start-up sequence for the control-room theme. Click or press a key to skip. */
export function BootScreen({ agents, onDone }: { agents: AgentConfig[]; onDone(): void }): React.JSX.Element {
  const lines = [
    'VANDELAY INDUSTRIES // ROBOTICS DIVISION',
    'IMPORTER / EXPORTER OF WORK  v0.2',
    '',
    'MOUNTING HIVE ........................ OK',
    'STARTING ROUTER ...................... OK',
    ...agents.map((a, i) => `${unitTag(i)} ${a.name.toUpperCase().padEnd(18, '.')} ONLINE`),
    '',
    'ALL UNITS REPORTING. GIDDYUP.'
  ]
  const [shown, setShown] = useState(0)
  // The parent re-renders every tick with a new callback; keep timers from restarting with it.
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (shown >= lines.length) {
      const t = setTimeout(() => done.current(), 500)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [shown, lines.length])

  useEffect(() => {
    const skip = (): void => done.current()
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [])

  return (
    <div className="boot" onClick={() => done.current()}>
      <pre>
        {lines.slice(0, shown).join('\n')}
        <span className="cursor">█</span>
      </pre>
    </div>
  )
}
