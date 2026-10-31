import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { commandExists } from './terminals'

const PALETTE = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e5572', '#2a9d8f', '#d4a373']

const SHELL = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'

function defaultAgents(): AgentConfig[] {
  // The orchestrator is only useful as a real agent CLI; fall back to a shell when none is installed.
  const boss = commandExists('claude') ? 'claude' : SHELL
  return [
    { id: 'art', name: 'Art Vandelay', command: boss, args: [], cwd: '', color: PALETTE[0], orchestrator: true },
    { id: 'kramer', name: 'Kramer', command: SHELL, args: [], cwd: '', color: PALETTE[1] },
    { id: 'elaine', name: 'Elaine', command: SHELL, args: [], cwd: '', color: PALETTE[2] }
  ]
}

const PROTOCOL = `# Vandelay Agents hive protocol

Every agent has a folder at \`.vandelay/agents/<id>/\`:

- \`inbox/\`   messages for you. Read them, act on them, then move them to \`archive/\`.
- \`outbox/\`  to message another agent, write a \`.md\` file here. The router delivers it.
- \`archive/\` messages you have handled.
- \`memory.md\` your long-term notes. Read it when you start, add to it when you learn something.

An outbox message starts with a \`to:\` line, then \`---\`, then the body:

\`\`\`
to: kramer
---
Please write tests for src/parser.ts and reply when done.
\`\`\`

Never edit another agent's folder directly. Only the router moves files between agents.
`

const ORCHESTRATOR_ROLE = `# Role: orchestrator

You are Art Vandelay, head of Vandelay Industries (importer/exporter of work).
The human briefs you through your inbox. Break the work into tasks, send each task to the
right agent through your outbox, and collect their replies. Answer the human by writing to
\`to: you\`. Escalate only decisions that need the human (spending money, deleting things, scope changes).
`

export class Hive extends EventEmitter {
  readonly root: string
  private agents: AgentConfig[] = []
  private timer: NodeJS.Timeout | null = null

  constructor(readonly workspace: string) {
    super()
    this.root = join(workspace, '.vandelay')
  }

  init(): void {
    mkdirSync(join(this.root, 'agents'), { recursive: true })
    mkdirSync(join(this.root, 'dead-letter'), { recursive: true })
    mkdirSync(join(this.root, 'you'), { recursive: true })
    writeFileSync(join(this.root, 'PROTOCOL.md'), PROTOCOL)
    const file = join(this.root, 'agents.json')
    this.agents = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : defaultAgents()
    this.save()
    this.agents.forEach((a) => this.ensureAgentDirs(a))
  }

  list(): AgentConfig[] {
    return this.agents
  }

  get(id: string): AgentConfig | undefined {
    return this.agents.find((a) => a.id === id)
  }

  add(input: Omit<AgentConfig, 'id' | 'color'>): AgentConfig {
    const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
    let id = base
    for (let n = 2; this.get(id) || id === 'you'; n++) id = `${base}-${n}`
    const agent: AgentConfig = { ...input, id, color: PALETTE[this.agents.length % PALETTE.length] }
    this.agents.push(agent)
    this.ensureAgentDirs(agent)
    this.save()
    return agent
  }

  agentDir(id: string): string {
    return join(this.root, 'agents', id)
  }

  /** Put a message straight into an agent's inbox (used for messages from the human). */
  deliver(from: string, to: string, body: string): HiveMessage {
    const at = Date.now()
    const msgId = `${at}-${from}`
    const dir = to === 'you' ? join(this.root, 'you') : join(this.agentDir(to), 'inbox')
    const file = join(dir, `${msgId}.md`)
    const text = `from: ${from}\nto: ${to}\nat: ${new Date(at).toISOString()}\n---\n${body.trim()}\n`
    writeFileSync(file + '.tmp', text)
    renameSync(file + '.tmp', file)
    const msg: HiveMessage = { id: msgId, from, to, body: body.trim(), file, at }
    this.emit('delivered', msg)
    return msg
  }

  startRouter(intervalMs = 1000): void {
    this.timer = setInterval(() => this.route(), intervalMs)
  }

  stopRouter(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private route(): void {
    for (const agent of this.agents) {
      const outbox = join(this.agentDir(agent.id), 'outbox')
      let files: string[]
      try {
        files = readdirSync(outbox).filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      } catch {
        continue
      }
      for (const f of files) {
        const path = join(outbox, f)
        try {
          // Leave files alone while the agent may still be writing them.
          if (Date.now() - statSync(path).mtimeMs < 500) continue
          const { to, body } = parseOutgoing(readFileSync(path, 'utf8'))
          if (to && (to === 'you' || this.get(to))) {
            this.deliver(agent.id, to, body)
            renameSync(path, join(this.agentDir(agent.id), 'archive', `sent-${Date.now()}-${f}`))
          } else {
            renameSync(path, join(this.root, 'dead-letter', `${agent.id}-${Date.now()}-${f}`))
            this.emit('undeliverable', { from: agent.id, to, file: f })
          }
        } catch (err) {
          console.error('[hive] failed to route', path, err)
        }
      }
    }
  }

  private ensureAgentDirs(a: AgentConfig): void {
    const dir = this.agentDir(a.id)
    for (const sub of ['inbox', 'outbox', 'archive']) mkdirSync(join(dir, sub), { recursive: true })
    const memory = join(dir, 'memory.md')
    if (!existsSync(memory)) writeFileSync(memory, `# ${a.name} memory\n\n`)
    if (a.orchestrator) writeFileSync(join(dir, 'ROLE.md'), ORCHESTRATOR_ROLE)
  }

  private save(): void {
    writeFileSync(join(this.root, 'agents.json'), JSON.stringify(this.agents, null, 2))
  }
}

/** Reads `to: <id>` from the header lines above `---`. Without a separator the whole file is the body. */
export function parseOutgoing(text: string): { to: string | null; body: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const sep = lines.findIndex((l) => l.trim() === '---')
  if (sep === -1) return { to: null, body: text }
  let to: string | null = null
  for (const line of lines.slice(0, sep)) {
    const m = /^to:\s*(.+)$/i.exec(line.trim())
    if (m) to = m[1].trim().toLowerCase()
  }
  return { to, body: lines.slice(sep + 1).join('\n') }
}
