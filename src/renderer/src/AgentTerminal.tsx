import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { AgentConfig } from '@shared/types'
import { terminalTheme, type Theme } from './status'

interface Props {
  agent: AgentConfig
  visible: boolean
  /** Bumped by the parent to respawn the process after it exits. */
  generation: number
  theme: Theme
}

export function AgentTerminal({ agent, visible, generation, theme }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fit = useRef<FitAddon | null>(null)

  useEffect(() => {
    const t = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Mono', Consolas, Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: terminalTheme(theme, agent.color)
    })
    const f = new FitAddon()
    t.loadAddon(f)
    t.open(host.current!)
    term.current = t
    fit.current = f

    const offData = window.vandelay.onData((id, data) => id === agent.id && t.write(data))
    const offExit = window.vandelay.onExit((id, code) => {
      if (id === agent.id) t.write(`\r\n\x1b[2m[process exited with code ${code}]\x1b[0m\r\n`)
    })
    const input = t.onData((data) => window.vandelay.write(agent.id, data))
    // Ctrl+C belongs to the agent (interrupt), so copy and paste use Ctrl+Shift like other terminals.
    t.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey) return true
      if (e.code === 'KeyC' && t.hasSelection()) {
        navigator.clipboard.writeText(t.getSelection()).catch(() => {})
        return false
      }
      if (e.code === 'KeyV') {
        // Otherwise Chromium's own paste-as-plain-text pastes a second copy.
        e.preventDefault()
        navigator.clipboard.readText().then((text) => text && t.paste(text), () => {})
        return false
      }
      return true
    })

    const ro = new ResizeObserver(() => {
      if (!host.current?.offsetWidth) return
      f.fit()
      window.vandelay.resize(agent.id, t.cols, t.rows)
    })
    ro.observe(host.current!)

    return () => {
      ro.disconnect()
      offData()
      offExit()
      input.dispose()
      t.dispose()
    }
  }, [agent.id])

  useEffect(() => {
    const t = term.current!
    if (host.current?.offsetWidth) fit.current!.fit()
    window.vandelay.startAgent(agent.id, t.cols, t.rows).catch((err) => t.write(`\x1b[31m${String(err)}\x1b[0m\r\n`))
  }, [agent.id, generation])

  useEffect(() => {
    if (visible) term.current?.focus()
  }, [visible])

  useEffect(() => {
    if (term.current) term.current.options.theme = terminalTheme(theme, agent.color)
  }, [theme, agent.color])

  return <div ref={host} className="terminal-host" style={{ visibility: visible ? 'visible' : 'hidden' }} />
}
