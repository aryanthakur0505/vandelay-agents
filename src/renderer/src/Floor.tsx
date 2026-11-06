import { useEffect, useRef } from 'react'
import type { AgentConfig } from '@shared/types'
import { badgeCount } from './format'
import { statusColors, unitTag, type AgentStatus, type Theme } from './status'

export interface Flight {
  from: string
  to: string
  start: number
}

interface Props {
  agents: AgentConfig[]
  statuses: Record<string, AgentStatus>
  unread: Record<string, number>
  flights: Flight[]
  selected: string | null
  theme: Theme
  onSelect(id: string): void
}

const PX = 3 // one art pixel in screen pixels
const FLIGHT_MS = 900
const MONO = "'JetBrains Mono', Consolas, monospace"

interface Spot {
  x: number
  y: number
}

interface Scene {
  agents: AgentConfig[]
  spots: Record<string, Spot>
  statuses: Record<string, AgentStatus>
  unread: Record<string, number>
  flights: Flight[]
  selected: string | null
  w: number
  h: number
  t: number
}

/** Orchestrator sits in the corner office, everyone else at desks in the bullpen. "you" is the front door. */
function layout(agents: AgentConfig[], w: number, h: number): Record<string, Spot> {
  const spots: Record<string, Spot> = { you: { x: w / 2, y: h - 18 } }
  const boss = agents.find((a) => a.orchestrator)
  if (boss) spots[boss.id] = { x: 110, y: 110 }
  const staff = agents.filter((a) => !a.orchestrator)
  if (staff.length === 0) return spots
  // As many desks per row as fit, then even rows, then squeeze the spacing so every desk stays above
  // the front door. A desk with its label needs about 115 px across and 95 px down.
  const left = 290
  const right = w - 70
  const top = 90
  const bottom = h - 150
  const fit = Math.max(1, Math.floor((right - left) / 115) + 1)
  const rows = Math.ceil(staff.length / fit)
  const cols = Math.ceil(staff.length / rows)
  const dx = cols > 1 ? Math.min(150, (right - left) / (cols - 1)) : 0
  const dy = rows > 1 ? Math.max(95, Math.min(140, (bottom - top) / (rows - 1))) : 0
  staff.forEach((a, i) => {
    spots[a.id] = { x: left + (i % cols) * dx, y: top + Math.floor(i / cols) * dy }
  })
  return spots
}

// ---------------------------------------------------------------------------------------------
// Office theme: carpet, wooden desks, people, paper envelopes.

const OFFICE_STATUS = statusColors('office')

function officeFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = 32
  for (let y = 0; y < h; y += tile)
    for (let x = 0; x < w; x += tile) {
      ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#3b3330' : '#372f2c'
      ctx.fillRect(x, y, tile, tile)
    }
  // Corner office: carpet plus a glass wall with a door gap.
  ctx.fillStyle = '#4a2f2a'
  ctx.fillRect(0, 0, 220, 220)
  ctx.fillStyle = 'rgba(160, 200, 220, 0.35)'
  ctx.fillRect(220, 0, 6, 150)
  ctx.fillRect(0, 220, 160, 6)
  ctx.fillStyle = '#c9b48a'
  ctx.font = 'bold 11px Consolas, monospace'
  ctx.fillText('VANDELAY INDUSTRIES', 12, 20)
  ctx.fillText('importer / exporter', 12, 34)
  // Front door.
  ctx.fillStyle = '#6b4f3a'
  ctx.fillRect(w / 2 - 30, h - 8, 60, 8)
}

/** Drawn after the avatar: the agent sits behind the desk, facing us, with the monitor's back to us. */
function officeDesk(ctx: CanvasRenderingContext2D, s: Spot): void {
  ctx.fillStyle = '#7a5a3c'
  ctx.fillRect(s.x - 40, s.y + 6, 80, 26)
  ctx.fillStyle = '#5d432c'
  ctx.fillRect(s.x - 40, s.y + 28, 80, 4)
  ctx.fillStyle = '#2b2b2b'
  ctx.fillRect(s.x + 10, s.y - 8, 24, 16)
  ctx.fillStyle = '#3d3d3d'
  ctx.fillRect(s.x + 19, s.y + 8, 6, 3)
}

function officePerson(ctx: CanvasRenderingContext2D, a: AgentConfig, s: Spot, status: AgentStatus, t: number): void {
  const bob = status === 'working' ? Math.round(Math.sin(t / 120) * 1) : 0
  const ox = s.x - 4 * PX
  const oy = s.y - 26 + bob
  const px = (x: number, y: number, w: number, hgt: number, c: string): void => {
    ctx.fillStyle = c
    ctx.fillRect(ox + x * PX, oy + y * PX, w * PX, hgt * PX)
  }
  if (status === 'exited') ctx.globalAlpha = 0.45
  px(2, 0, 4, 2, '#3b2a20') // hair
  px(2, 2, 4, 3, '#e0b48c') // face
  px(3, 3, 1, 1, '#222')
  px(5, 3, 1, 1, '#222')
  px(1, 5, 6, 4, a.color) // shirt
  px(0, 6, 1, 3, a.color)
  px(7, 6, 1, 3, a.color)
  ctx.globalAlpha = 1
}

function officeBadge(ctx: CanvasRenderingContext2D, a: AgentConfig, s: Spot, status: AgentStatus, unread: number, selected: boolean): void {
  ctx.font = '12px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = selected ? '#ffffff' : '#ece4d8'
  ctx.fillText(a.name, s.x, s.y + 48)
  ctx.fillStyle = OFFICE_STATUS[status]
  ctx.beginPath()
  ctx.arc(s.x - ctx.measureText(a.name).width / 2 - 8, s.y + 44, 4, 0, Math.PI * 2)
  ctx.fill()
  if (unread > 0) {
    ctx.fillStyle = '#f4e9c8'
    ctx.fillRect(s.x + 22, s.y - 32, 18, 12)
    ctx.strokeStyle = '#8a6d3b'
    ctx.strokeRect(s.x + 22, s.y - 32, 18, 12)
    ctx.fillStyle = '#8a3b2a'
    ctx.font = 'bold 10px Consolas, monospace'
    ctx.fillText(badgeCount(unread), s.x + 31, s.y - 22)
  }
  if (selected) {
    ctx.strokeStyle = a.color
    ctx.lineWidth = 2
    ctx.strokeRect(s.x - 48, s.y - 40, 96, 96)
    ctx.lineWidth = 1
  }
  ctx.textAlign = 'start'
}

function officeEnvelope(ctx: CanvasRenderingContext2D, from: Spot, to: Spot, p: number): void {
  const x = from.x + (to.x - from.x) * p
  const y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 50
  ctx.fillStyle = '#f4e9c8'
  ctx.fillRect(x - 8, y - 5, 16, 10)
  ctx.strokeStyle = '#8a6d3b'
  ctx.beginPath()
  ctx.moveTo(x - 8, y - 5)
  ctx.lineTo(x, y + 1)
  ctx.lineTo(x + 8, y - 5)
  ctx.stroke()
}

function drawOffice(ctx: CanvasRenderingContext2D, sc: Scene): void {
  officeFloor(ctx, sc.w, sc.h)
  for (const a of sc.agents) {
    const s = sc.spots[a.id]
    const status = sc.statuses[a.id] ?? 'starting'
    officePerson(ctx, a, s, status, sc.t)
    officeDesk(ctx, s)
    officeBadge(ctx, a, s, status, sc.unread[a.id] ?? 0, a.id === sc.selected)
  }
  for (const f of sc.flights) {
    const p = (Date.now() - f.start) / FLIGHT_MS
    if (p >= 0 && p <= 1 && sc.spots[f.from] && sc.spots[f.to]) officeEnvelope(ctx, sc.spots[f.from], sc.spots[f.to], p)
  }
}

// ---------------------------------------------------------------------------------------------
// Control-room theme: a glowing grid, circuit traces, workstations and robots, data packets.

const CYAN = '#3fd0ff'
const CONTROL_STATUS = statusColors('control')

/** Traces run along the grid: across first, then down. */
function tracePath(a: Spot, b: Spot): Spot[] {
  return [a, { x: b.x, y: a.y }, b]
}

function pointOnPath(path: Spot[], p: number): Spot {
  const lengths = path.slice(1).map((pt, i) => Math.hypot(pt.x - path[i].x, pt.y - path[i].y))
  let d = lengths.reduce((s, l) => s + l, 0) * p
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? Math.min(1, d / lengths[i]) : 0
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k }
    }
    d -= lengths[i]
  }
  return path[path.length - 1]
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number): void {
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1]
  ]) {
    ctx.moveTo(cx + dx * len, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * len)
  }
  ctx.stroke()
}

function controlFloor(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { w, h } = sc
  ctx.fillStyle = '#050a10'
  ctx.fillRect(0, 0, w, h)
  ctx.lineWidth = 1
  for (let x = 0; x < w; x += 24) {
    ctx.strokeStyle = x % 96 === 0 ? 'rgba(63, 208, 255, 0.10)' : 'rgba(63, 208, 255, 0.04)'
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, h)
    ctx.stroke()
  }
  for (let y = 0; y < h; y += 24) {
    ctx.strokeStyle = y % 96 === 0 ? 'rgba(63, 208, 255, 0.10)' : 'rgba(63, 208, 255, 0.04)'
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(w, y + 0.5)
    ctx.stroke()
  }
  // Command core for the orchestrator.
  ctx.fillStyle = 'rgba(63, 208, 255, 0.05)'
  ctx.fillRect(8, 8, 204, 204)
  ctx.strokeStyle = 'rgba(63, 208, 255, 0.55)'
  brackets(ctx, 8, 8, 204, 204, 16)
  ctx.fillStyle = CYAN
  ctx.font = `bold 10px ${MONO}`
  ctx.fillText('COMMAND CORE', 18, 26)
  ctx.fillStyle = 'rgba(63, 208, 255, 0.55)'
  ctx.fillText('VANDELAY // R&D', 18, 39)
  // The operator's terminal: where your briefs come in.
  const you = sc.spots.you
  ctx.strokeStyle = 'rgba(63, 208, 255, 0.6)'
  ctx.strokeRect(you.x - 40, you.y - 6, 80, 18)
  ctx.fillStyle = CYAN
  ctx.textAlign = 'center'
  ctx.fillText('OPERATOR', you.x, you.y + 7)
  ctx.textAlign = 'start'
}

function controlTraces(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const boss = sc.agents.find((a) => a.orchestrator)
  if (!boss) return
  const hub = sc.spots[boss.id]
  const lines = [tracePath(sc.spots.you, hub), ...sc.agents.filter((a) => a !== boss).map((a) => tracePath(hub, sc.spots[a.id]))]
  ctx.strokeStyle = 'rgba(63, 208, 255, 0.22)'
  ctx.lineWidth = 2
  for (const path of lines) {
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (const pt of path.slice(1)) ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    ctx.fillStyle = 'rgba(63, 208, 255, 0.5)'
    ctx.fillRect(path[1].x - 2, path[1].y - 2, 4, 4) // a via at the bend
  }
  ctx.lineWidth = 1
}

/** A console: dark slab with a lit edge, a screen that scrolls while working, and a row of LEDs. */
function workstation(ctx: CanvasRenderingContext2D, s: Spot, status: AgentStatus, t: number, seed: number): void {
  const working = status === 'working'
  ctx.fillStyle = '#0c1724'
  ctx.fillRect(s.x - 42, s.y + 6, 84, 24)
  ctx.fillStyle = 'rgba(63, 208, 255, 0.7)'
  ctx.fillRect(s.x - 42, s.y + 6, 84, 2)
  // Screen, seen from behind the robot: lines of "output" that scroll while working.
  ctx.fillStyle = '#04121c'
  ctx.fillRect(s.x + 12, s.y - 12, 26, 18)
  ctx.strokeStyle = 'rgba(63, 208, 255, 0.6)'
  ctx.strokeRect(s.x + 12.5, s.y - 11.5, 25, 17)
  const scroll = working ? Math.floor(t / 150) : 0
  for (let i = 0; i < 4; i++) {
    const len = 6 + ((seed * 7 + (i + scroll) * 13) % 14)
    ctx.fillStyle = working ? 'rgba(57, 255, 136, 0.8)' : 'rgba(63, 208, 255, 0.35)'
    ctx.fillRect(s.x + 15, s.y - 9 + i * 4, len, 2)
  }
  // LEDs blink while working, glow steady otherwise.
  for (let i = 0; i < 6; i++) {
    const on = working ? (Math.floor(t / 90) + i * 3 + seed) % 5 < 2 : status !== 'exited'
    ctx.fillStyle = on ? CONTROL_STATUS[status] : '#13202d'
    ctx.fillRect(s.x - 36 + i * 7, s.y + 20, 4, 4)
  }
}

function robot(ctx: CanvasRenderingContext2D, a: AgentConfig, s: Spot, status: AgentStatus, t: number): void {
  const working = status === 'working'
  const bob = working ? Math.round(Math.sin(t / 110)) : 0
  const ox = s.x - 4.5 * PX
  const oy = s.y - 30 + bob
  const px = (x: number, y: number, w: number, hgt: number, c: string): void => {
    ctx.fillStyle = c
    ctx.fillRect(ox + x * PX, oy + y * PX, w * PX, hgt * PX)
  }
  const glow = CONTROL_STATUS[status]
  const led = working ? (Math.floor(t / 250) % 2 === 0 ? glow : '#1b2a38') : glow
  if (status === 'exited') ctx.globalAlpha = 0.4
  px(4, 1, 1, 1, '#6b7d90') // antenna
  ctx.shadowColor = glow
  ctx.shadowBlur = status === 'exited' ? 0 : 8
  px(4, 0, 1, 1, led)
  ctx.shadowBlur = 0
  px(1, 2, 7, 5, '#9fb2c6') // head
  px(1, 2, 7, 1, '#c8d6e4')
  px(0, 3, 1, 2, '#6b7d90') // ears
  px(8, 3, 1, 2, '#6b7d90')
  ctx.shadowColor = glow
  ctx.shadowBlur = status === 'exited' ? 0 : 6
  px(2, 4, 5, 1, status === 'exited' ? '#1b2a38' : glow) // visor
  ctx.shadowBlur = 0
  px(2, 6, 5, 1, '#6b7d90') // jaw
  px(2, 7, 5, 3, a.color) // chassis in the agent's color
  px(4, 8, 1, 1, 'rgba(255, 255, 255, 0.85)') // core light
  px(1, 7, 1, 3, '#6b7d90') // arms
  px(7, 7, 1, 3, '#6b7d90')
  ctx.globalAlpha = 1
}

function controlBadge(
  ctx: CanvasRenderingContext2D,
  a: AgentConfig,
  index: number,
  s: Spot,
  status: AgentStatus,
  unread: number,
  selected: boolean
): void {
  ctx.textAlign = 'center'
  ctx.font = `bold 11px ${MONO}`
  ctx.fillStyle = selected ? '#ffffff' : '#cfe8f5'
  ctx.fillText(a.name.toUpperCase(), s.x, s.y + 46)
  ctx.font = `9px ${MONO}`
  ctx.fillStyle = CONTROL_STATUS[status]
  ctx.fillText(`${unitTag(index)}${a.temp ? ' // TEMP' : ''}`, s.x, s.y + 58)
  if (unread > 0) {
    ctx.fillStyle = '#04121c'
    ctx.fillRect(s.x + 22, s.y - 38, 22, 13)
    ctx.strokeStyle = CYAN
    ctx.strokeRect(s.x + 22.5, s.y - 37.5, 21, 12)
    ctx.fillStyle = CYAN
    ctx.font = `bold 9px ${MONO}`
    ctx.fillText(`▼${badgeCount(unread)}`, s.x + 33, s.y - 28)
  }
  if (selected) {
    ctx.strokeStyle = CYAN
    ctx.lineWidth = 2
    brackets(ctx, s.x - 52, s.y - 46, 104, 110, 12)
    ctx.lineWidth = 1
  }
  ctx.textAlign = 'start'
}

/** A glowing packet with a short trail, running along the circuit trace. */
function packet(ctx: CanvasRenderingContext2D, from: Spot, to: Spot, p: number): void {
  const path = tracePath(from, to)
  for (let i = 4; i >= 0; i--) {
    const pt = pointOnPath(path, Math.max(0, p - i * 0.035))
    ctx.fillStyle = i === 0 ? '#ffffff' : `rgba(63, 208, 255, ${0.5 - i * 0.1})`
    ctx.shadowColor = CYAN
    ctx.shadowBlur = i === 0 ? 14 : 0
    const size = i === 0 ? 7 : 5 - i
    ctx.fillRect(pt.x - size / 2, pt.y - size / 2, size, size)
  }
  ctx.shadowBlur = 0
}

function drawControl(ctx: CanvasRenderingContext2D, sc: Scene): void {
  controlFloor(ctx, sc)
  controlTraces(ctx, sc)
  sc.agents.forEach((a, i) => {
    const s = sc.spots[a.id]
    const status = sc.statuses[a.id] ?? 'starting'
    robot(ctx, a, s, status, sc.t)
    workstation(ctx, s, status, sc.t, i)
    controlBadge(ctx, a, i, s, status, sc.unread[a.id] ?? 0, a.id === sc.selected)
  })
  for (const f of sc.flights) {
    const p = (Date.now() - f.start) / FLIGHT_MS
    // Notices from the app start at the operator's terminal.
    const from = sc.spots[f.from] ?? sc.spots.you
    if (p >= 0 && p <= 1 && sc.spots[f.to]) packet(ctx, from, sc.spots[f.to], p)
  }
}

// ---------------------------------------------------------------------------------------------

export function Floor(props: Props): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    let frame = 0
    const draw = (): void => {
      const c = canvas.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr
        c.height = h * dpr
      }
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      const { agents, statuses, unread, flights, selected, theme } = latest.current
      const scene: Scene = { agents, spots: layout(agents, w, h), statuses, unread, flights, selected, w, h, t: performance.now() }
      if (theme === 'control') drawControl(ctx, scene)
      else drawOffice(ctx, scene)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const spots = layout(props.agents, c.clientWidth, c.clientHeight)
    const hit = props.agents.find((a) => Math.abs(spots[a.id].x - x) < 48 && Math.abs(spots[a.id].y + 8 - y) < 48)
    if (hit) props.onSelect(hit.id)
  }

  // The wrapper owns the size; a canvas in a flex column would otherwise grow with its own backing store.
  return (
    <div className="floor">
      <canvas ref={canvas} onClick={onClick} />
    </div>
  )
}

export { FLIGHT_MS }
