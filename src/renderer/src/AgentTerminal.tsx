import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { AgentConfig } from '@shared/types'
import { useLatest } from './hooks'
import { terminalTheme, type Theme } from './status'

interface Props {
  agent: AgentConfig
  visible: boolean
  /** Bumped by the parent to respawn the process after it exits. */
  generation: number
  theme: Theme
  fontSize: number
  /** Ctrl+wheel over the terminal asks for a bigger (+1) or smaller (-1) font. */
  onZoom(step: number): void
}

export function AgentTerminal({ agent, visible, generation, theme, fontSize, onZoom }: Props): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const term = useRef<Terminal | null>(null)
  const fit = useRef<FitAddon | null>(null)

  useEffect(() => {
    const t = new Terminal({
      fontFamily: "'JetBrains Mono', 'Cascadia Mono', Consolas, Menlo, monospace",
      fontSize,
      cursorBlink: true,
      scrollback: 5000,
      theme: terminalTheme(theme, agent.color)
    })
    const f = new FitAddon()
    t.loadAddon(f)
    // URLs agents print (PRs, docs, localhost servers) become clickable; the main process opens them
    // in the browser, and only http(s) ones.
    t.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri)))
    t.open(host.current!)
    term.current = t
    fit.current = f

    const offData = window.vandelay.onData((id, data) => id === agent.id && t.write(data))
    const offExit = window.vandelay.onExit((id, code) => {
      if (id === agent.id) t.write(`\r\n\x1b[2m[process exited with code ${code} · Start in the toolbar runs it again]\x1b[0m\r\n`)
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
        navigator.clipboard.readText().then(
          (text) => text && t.paste(text),
          () => {}
        )
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

  useEffect(() => {
    const t = term.current
    if (!t || t.options.fontSize === fontSize) return
    t.options.fontSize = fontSize
    // A new font size changes how many rows and columns fit, so refit and tell the PTY.
    if (host.current?.offsetWidth) {
      fit.current!.fit()
      window.vandelay.resize(agent.id, t.cols, t.rows)
    }
  }, [fontSize, agent.id])

  const zoom = useLatest(onZoom)
  useEffect(() => {
    const el = host.current!
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoom.current(e.deltaY < 0 ? 1 : -1)
    }
    // Not passive, so preventDefault keeps the terminal from scrolling while zooming.
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [zoom])

  return <div ref={host} className="terminal-host" style={{ visibility: visible ? 'visible' : 'hidden' }} />
}
