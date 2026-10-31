import { useEffect, useRef } from 'react'
import type { AgentConfig } from '@shared/types'
import { STATUS_COLOR, type AgentStatus } from './status'

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
  onSelect(id: string): void
}

const PX = 3 // one art pixel in screen pixels
const FLIGHT_MS = 900

interface Spot {
  x: number
  y: number
}

/** Orchestrator sits in the corner office, everyone else at desks in the bullpen. "you" is the front door. */
function layout(agents: AgentConfig[], w: number, h: number): Record<string, Spot> {
  const spots: Record<string, Spot> = { you: { x: w / 2, y: h - 18 } }
  const boss = agents.find((a) => a.orchestrator)
  if (boss) spots[boss.id] = { x: 110, y: 110 }
  const staff = agents.filter((a) => !a.orchestrator)
  const cols = Math.max(1, Math.floor((w - 240) / 150))
  staff.forEach((a, i) => {
    spots[a.id] = { x: 290 + (i % cols) * 150, y: 90 + Math.floor(i / cols) * 140 }
  })
  return spots
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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
function drawDesk(ctx: CanvasRenderingContext2D, s: Spot): void {
  ctx.fillStyle = '#7a5a3c'
  ctx.fillRect(s.x - 40, s.y + 6, 80, 26)
  ctx.fillStyle = '#5d432c'
  ctx.fillRect(s.x - 40, s.y + 28, 80, 4)
  ctx.fillStyle = '#2b2b2b'
  ctx.fillRect(s.x + 10, s.y - 8, 24, 16)
  ctx.fillStyle = '#3d3d3d'
  ctx.fillRect(s.x + 19, s.y + 8, 6, 3)
}

function drawAvatar(ctx: CanvasRenderingContext2D, a: AgentConfig, s: Spot, status: AgentStatus, t: number): void {
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

function drawBadge(ctx: CanvasRenderingContext2D, a: AgentConfig, s: Spot, status: AgentStatus, unread: number, selected: boolean): void {
  ctx.font = '12px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = selected ? '#ffffff' : '#ece4d8'
  ctx.fillText(a.name, s.x, s.y + 48)
  ctx.fillStyle = STATUS_COLOR[status]
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
    ctx.fillText(String(unread), s.x + 31, s.y - 22)
  }
  if (selected) {
    ctx.strokeStyle = a.color
    ctx.lineWidth = 2
    ctx.strokeRect(s.x - 48, s.y - 40, 96, 96)
    ctx.lineWidth = 1
  }
  ctx.textAlign = 'start'
}

function drawEnvelope(ctx: CanvasRenderingContext2D, from: Spot, to: Spot, p: number): void {
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
      const { agents, statuses, unread, flights, selected } = latest.current
      const spots = layout(agents, w, h)
      const now = performance.now()
      drawFloor(ctx, w, h)
      for (const a of agents) {
        const s = spots[a.id]
        const status = statuses[a.id] ?? 'starting'
        drawAvatar(ctx, a, s, status, now)
        drawDesk(ctx, s)
        drawBadge(ctx, a, s, status, unread[a.id] ?? 0, a.id === selected)
      }
      for (const f of flights) {
        const p = (Date.now() - f.start) / FLIGHT_MS
        if (p >= 0 && p <= 1 && spots[f.from] && spots[f.to]) drawEnvelope(ctx, spots[f.from], spots[f.to], p)
      }
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
