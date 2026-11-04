import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_TEMPS, ROLE_TEMPLATES } from '@shared/templates'
import type { AgentConfig, AgentInput, HiveMessage } from '@shared/types'
import { findExecutable } from './terminals'

const PALETTE = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e5572', '#2a9d8f', '#d4a373']

const SHELL = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'

/** The app itself, as a sender: team updates and HR replies come from here. */
export const SYSTEM = 'vandelay'
/** Agents write `to: hr` to hire or let go of temps. */
export const HR = 'hr'
const RESERVED = new Set(['you', SYSTEM, HR])

function templateRole(name: string): string | undefined {
  return ROLE_TEMPLATES.find((t) => t.name.toLowerCase() === name.toLowerCase())?.role
}

function defaultAgents(): AgentConfig[] {
  // Agents are only useful as a real agent CLI; fall back to a shell when none is installed.
  const cli = findExecutable('claude') ? 'claude' : SHELL
  const worker = (id: string, name: string, color: string): AgentConfig => ({
    id,
    name,
    command: cli,
    args: [],
    cwd: '',
    color,
    role: templateRole(name),
    model: 'sonnet'
  })
  return [
    { id: 'art', name: 'Art Vandelay', command: cli, args: [], cwd: '', color: PALETTE[0], orchestrator: true },
    worker('kramer', 'Kramer', PALETTE[1]),
    worker('elaine', 'Elaine', PALETTE[2])
  ]
}

const PROTOCOL = `# Vandelay Agents hive protocol

Every agent has a folder at \`.vandelay/agents/<id>/\`:

- \`inbox/\`   messages for you. Read them, act on them, then move them to \`archive/\`.
- \`outbox/\`  to message another agent, write a \`.md\` file here. The router delivers it.
- \`archive/\` messages you have handled.
- \`memory.md\` your long-term notes. Read it when you start, add to it when you learn something.

The team, with each agent's id and specialty, is in \`.vandelay/ROSTER.md\`. It changes as agents
are hired and let go.

An outbox message starts with a \`to:\` line, then \`---\`, then the body:

\`\`\`
to: kramer
---
Please write tests for src/parser.ts and reply when done.
\`\`\`

Never edit another agent's folder directly. Only the router moves files between agents.

Only reply to a message that asks for something. Don't answer a reply or an acknowledgement, and
don't send thank-you notes, or two agents can end up messaging each other forever. Messages from
\`${SYSTEM}\` are notices from the app itself; never reply to them.
`

const ORCHESTRATOR_ROLE = `# Role: orchestrator

You are Art Vandelay, head of Vandelay Industries (importer/exporter of work).
The human briefs you through your inbox. Break the work into tasks, send each task to the agent
whose specialty fits best (see ROSTER.md), and collect their replies. Answer the human by writing
to \`to: you\`. Escalate only decisions that need the human (spending money, deleting things, scope
changes). When the team changes you get a notice from \`${SYSTEM}\`.

## Temps

For a one-off job nobody on the roster fits, hire a temp by writing to \`to: ${HR}\`:

\`\`\`
to: ${HR}
---
hire: Bania
role: One line on what this temp is for.
model: haiku
\`\`\`

\`model\` is optional. HR replies with the temp's id; brief the temp like anyone else. When the job
is done, let the temp go with \`fire: <id>\` in a message to \`${HR}\`. You can have at most ${MAX_TEMPS}
temps at once.
`

const WORKER_ROLE = `# Role: worker

You work for Vandelay Industries. Tasks arrive in your inbox, usually from Art Vandelay (\`art\`).
Do the work in the workspace, then reply to whoever sent the task through your outbox with a
short report of what you did. If you are blocked or the task is unclear, ask the sender instead
of guessing. Keep replies brief.
`

function roleFile(a: AgentConfig): string {
  let text = a.orchestrator ? ORCHESTRATOR_ROLE : WORKER_ROLE
  if (a.role) text += `\n## Your specialty\n\n${a.role}\n`
  if (a.temp) text += `\nYou are a temp, hired by \`${a.hiredBy}\` for one job. Report back to them when it is done.\n`
  if (a.worktree)
    text += `\nYou work in your own git worktree on branch \`vandelay/${a.id}\`. Commit your work there and say so in your reply.\n`
  return text
}

function rosterFile(agents: AgentConfig[]): string {
  const lines = agents.map((a) => {
    const what = a.orchestrator ? 'Orchestrator. Takes briefs from the human and routes work.' : a.role || 'General worker, no specialty set.'
    const notes = [a.temp && `temp hired by ${a.hiredBy}`, a.model && `model ${a.model}`, a.autonomy === 'read-only' && 'read-only']
      .filter(Boolean)
      .join(', ')
    return `- \`${a.id}\` **${a.name}**: ${what}${notes ? ` _(${notes})_` : ''}`
  })
  return `# Team roster\n\nMessage an agent with \`to: <id>\`. The human is \`you\`.\n\n${lines.join('\n')}\n`
}

/** `key: value` lines, keys lowercased. */
function parseFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of body.split('\n')) {
    const m = /^\s*([a-z]+)\s*:\s*(.+?)\s*$/i.exec(line)
    if (m) fields[m[1].toLowerCase()] = m[2]
  }
  return fields
}

export class Hive extends EventEmitter {
  readonly root: string
  private agents: AgentConfig[] = []
  private timer: NodeJS.Timeout | null = null
  /** Keeps message ids unique when one sender delivers several in the same millisecond. */
  private seq = 0

  constructor(readonly workspace: string) {
    super()
    this.root = join(workspace, '.vandelay')
  }

  init(): void {
    mkdirSync(join(this.root, 'agents'), { recursive: true })
    mkdirSync(join(this.root, 'dead-letter'), { recursive: true })
    mkdirSync(join(this.root, 'you'), { recursive: true })
    writeFileSync(join(this.root, 'PROTOCOL.md'), PROTOCOL)
    // Keep the hive out of the workspace's git status, whatever repository it sits in.
    writeFileSync(join(this.root, '.gitignore'), '*\n')
    const file = join(this.root, 'agents.json')
    this.agents = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : defaultAgents()
    // Older hives hired agents before roles existed; give the familiar names their usual role.
    for (const a of this.agents) if (!a.role && !a.orchestrator) a.role = templateRole(a.name)
    this.save()
    this.agents.forEach((a) => this.ensureAgentDirs(a))
  }

  list(): AgentConfig[] {
    return this.agents
  }

  get(id: string): AgentConfig | undefined {
    return this.agents.find((a) => a.id === id)
  }

  orchestrator(): AgentConfig | undefined {
    return this.agents.find((a) => a.orchestrator)
  }

  add(input: AgentInput, announce = true): AgentConfig {
    const base = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
    let id = base
    for (let n = 2; this.get(id) || RESERVED.has(id); n++) id = `${base}-${n}`
    // A second orchestrator would make routing ambiguous.
    const agent: AgentConfig = { ...input, orchestrator: undefined, id, color: PALETTE[this.agents.length % PALETTE.length] }
    this.agents.push(agent)
    this.ensureAgentDirs(agent)
    this.save()
    if (announce) this.announce(`New hire: \`${id}\` ${agent.name}. ${agent.role ?? 'No specialty set.'}`, id)
    return agent
  }

  /** Changes take effect the next time the agent starts. */
  update(id: string, patch: Partial<AgentInput>): AgentConfig {
    const agent = this.get(id)
    if (!agent) throw new Error(`Unknown agent ${id}`)
    const { orchestrator: _o, temp: _t, hiredBy: _h, ...allowed } = patch
    const roleChanged = allowed.role !== undefined && allowed.role !== agent.role
    Object.assign(agent, allowed)
    this.ensureAgentDirs(agent)
    this.save()
    if (roleChanged) this.announce(`\`${id}\` ${agent.name} has a new specialty: ${agent.role || 'none'}`, id)
    return agent
  }

  /** Lets an agent go: off the roster, folder moved to `former/` once its processes have stopped. */
  remove(id: string, announce = true): void {
    const agent = this.get(id)
    if (!agent) return
    if (agent.orchestrator) throw new Error('The orchestrator cannot be let go.')
    this.agents = this.agents.filter((a) => a.id !== id)
    this.save()
    this.emit('removed', id)
    if (announce) this.announce(`\`${id}\` ${agent.name} has left the team.`, id)
    setTimeout(() => {
      try {
        mkdirSync(join(this.root, 'former'), { recursive: true })
        renameSync(this.agentDir(id), join(this.root, 'former', `${id}-${Date.now()}`))
      } catch {
        // Still in use; the folder stays where it is, which is harmless.
      }
    }, 2000)
  }

  agentDir(id: string): string {
    return join(this.root, 'agents', id)
  }

  worktreeDir(id: string): string {
    return join(this.root, 'worktrees', id)
  }

  /** Put a message straight into an agent's inbox (used for messages from the human and the app). */
  deliver(from: string, to: string, body: string): HiveMessage {
    const at = Date.now()
    const msgId = `${at}-${String(this.seq++ % 1000).padStart(3, '0')}-${from}`
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
    for (const agent of [...this.agents]) {
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
          if (to === HR) {
            renameSync(path, join(this.agentDir(agent.id), 'archive', `sent-${Date.now()}-${f}`))
            this.handleHr(agent.id, body)
          } else if (to && (to === 'you' || this.get(to))) {
            this.deliver(agent.id, to, body)
            renameSync(path, join(this.agentDir(agent.id), 'archive', `sent-${Date.now()}-${f}`))
          } else {
            renameSync(path, join(this.root, 'dead-letter', `${agent.id}-${Date.now()}-${f}`))
            this.emit('undeliverable', { from: agent.id, to, file: f })
            // Otherwise the sender waits forever for a reply that can't come.
            this.deliver(
              SYSTEM,
              agent.id,
              to
                ? `Your message \`${f}\` was not delivered: there is no agent \`${to}\`. Check .vandelay/ROSTER.md for ids.`
                : `Your message \`${f}\` was not delivered: it has no \`to:\` line above a \`---\` separator.`
            )
          }
        } catch (err) {
          console.error('[hive] failed to route', path, err)
        }
      }
    }
  }

  /** The orchestrator hires and lets go of temps by mail; HR answers with what happened. */
  private handleHr(from: string, body: string): void {
    const fields = parseFields(body)
    const boss = this.get(from)
    let reply: string
    if (!boss?.orchestrator) reply = 'Only the orchestrator can hire or let go of temps.'
    else if (fields.fire) {
      const temp = this.get(fields.fire.replace(/`/g, '').toLowerCase())
      if (!temp?.temp || temp.hiredBy !== from) reply = `\`${fields.fire}\` is not one of your temps.`
      else {
        this.remove(temp.id, false)
        reply = `Let go of temp \`${temp.id}\`.`
      }
    } else if (fields.hire) {
      const temps = this.agents.filter((a) => a.temp && a.hiredBy === from)
      if (temps.length >= MAX_TEMPS)
        reply = `You already have ${temps.length} temps (${temps.map((t) => t.id).join(', ')}). Let one go first.`
      else {
        const temp = this.add(
          {
            name: fields.hire,
            role: fields.role,
            model: fields.model,
            autonomy: boss.autonomy,
            command: boss.command,
            args: [],
            cwd: '',
            temp: true,
            hiredBy: from
          },
          false
        )
        reply = `Hired temp \`${temp.id}\` (${temp.name}). Brief them with \`to: ${temp.id}\`, and send \`fire: ${temp.id}\` to ${HR} when the job is done.`
      }
    } else reply = `HR needs a \`hire: <name>\` line (plus \`role:\` and optionally \`model:\`), or \`fire: <id>\`.`
    this.deliver(SYSTEM, from, reply)
  }

  /** Tells the orchestrator about team changes, unless the change is about the orchestrator itself. */
  private announce(text: string, about: string): void {
    const boss = this.orchestrator()
    if (boss && boss.id !== about) this.deliver(SYSTEM, boss.id, text)
  }

  private ensureAgentDirs(a: AgentConfig): void {
    const dir = this.agentDir(a.id)
    for (const sub of ['inbox', 'outbox', 'archive']) mkdirSync(join(dir, sub), { recursive: true })
    const memory = join(dir, 'memory.md')
    if (!existsSync(memory)) writeFileSync(memory, `# ${a.name} memory\n\n`)
    writeFileSync(join(dir, 'ROLE.md'), roleFile(a))
  }

  private save(): void {
    writeFileSync(join(this.root, 'agents.json'), JSON.stringify(this.agents, null, 2))
    writeFileSync(join(this.root, 'ROSTER.md'), rosterFile(this.agents))
    this.emit('roster', this.agents)
  }
}

/** Reads `to: <id>` from the header lines above `---`. Without a separator the whole file is the body. */
export function parseOutgoing(text: string): { to: string | null; body: string } {
  // PowerShell's Set-Content -Encoding utf8 writes a byte-order mark.
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n')
  const sep = lines.findIndex((l) => l.trim() === '---')
  if (sep === -1) return { to: null, body: text }
  let to: string | null = null
  for (const line of lines.slice(0, sep)) {
    const m = /^to:\s*(.+)$/i.exec(line.trim())
    if (m) to = m[1].trim().toLowerCase()
  }
  return { to, body: lines.slice(sep + 1).join('\n') }
}
