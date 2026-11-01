import { existsSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Hive, parseOutgoing } from '../src/main/hive'
import { scratch, until } from './helpers'

describe('parseOutgoing', () => {
  it('reads the recipient above the separator', () => {
    expect(parseOutgoing('to: Kramer\n---\nGiddyup\n')).toEqual({ to: 'kramer', body: 'Giddyup\n' })
  })

  it('handles CRLF and the BOM PowerShell writes', () => {
    expect(parseOutgoing('﻿to: elaine\r\n---\r\nGet out!')).toEqual({ to: 'elaine', body: 'Get out!' })
  })

  it('has no recipient without a separator', () => {
    expect(parseOutgoing('just a note')).toEqual({ to: null, body: 'just a note' })
  })
})

describe('Hive', () => {
  let hive: Hive | undefined
  afterEach(() => hive?.stopRouter())

  /** A new hive comes with Art, Kramer and Elaine. */
  function makeHive(): Hive {
    hive = new Hive(scratch())
    hive.init()
    return hive
  }

  /** Write an outbox file old enough for the router to pick up. */
  function post(h: Hive, from: string, name: string, text: string): void {
    const file = join(h.agentDir(from), 'outbox', name)
    writeFileSync(file, text)
    const past = new Date(Date.now() - 5000)
    utimesSync(file, past, past)
  }

  it('lays out the hive and keeps it out of git', () => {
    const h = makeHive()
    expect(readFileSync(join(h.root, '.gitignore'), 'utf8')).toBe('*\n')
    expect(readFileSync(join(h.agentDir('kramer'), 'ROLE.md'), 'utf8')).toContain('Role: worker')
    expect(existsSync(join(h.agentDir('kramer'), 'memory.md'))).toBe(true)
  })

  it('never gives an agent the id "you" or a duplicate id', () => {
    const h = makeHive()
    expect(h.add({ name: 'You', command: 'x', args: [], cwd: '' }).id).toBe('you-2')
    expect(h.add({ name: 'Kramer', command: 'x', args: [], cwd: '' }).id).toBe('kramer-2')
  })

  it('routes outbox mail to the inbox and archives the sent copy', async () => {
    const h = makeHive()
    const delivered: string[] = []
    h.on('delivered', (m) => delivered.push(`${m.from}->${m.to}:${m.body}`))
    post(h, 'kramer', 'hi.md', 'to: elaine\n---\nhello')
    h.startRouter(50)
    await until(() => delivered.length > 0)
    expect(delivered).toEqual(['kramer->elaine:hello'])
    expect(readdirSync(join(h.agentDir('elaine'), 'inbox'))).toHaveLength(1)
    expect(readdirSync(join(h.agentDir('kramer'), 'outbox'))).toHaveLength(0)
    expect(readdirSync(join(h.agentDir('kramer'), 'archive'))[0]).toMatch(/^sent-.*hi\.md$/)
  })

  it('delivers replies for the human to you/', async () => {
    const h = makeHive()
    post(h, 'kramer', 'r.md', 'to: you\n---\ndone')
    h.startRouter(50)
    await until(() => readdirSync(join(h.root, 'you')).length > 0)
  })

  it('moves mail for unknown agents to dead-letter', async () => {
    const h = makeHive()
    post(h, 'kramer', 'lost.md', 'to: newman\n---\nhello')
    h.startRouter(50)
    await until(() => readdirSync(join(h.root, 'dead-letter')).length > 0)
  })

  it('leaves files that are still being written', async () => {
    const h = makeHive()
    writeFileSync(join(h.agentDir('kramer'), 'outbox', 'new.md'), 'to: you\n---\nhi')
    h.startRouter(50)
    await new Promise((r) => setTimeout(r, 200))
    expect(readdirSync(join(h.agentDir('kramer'), 'outbox'))).toEqual(['new.md'])
  })
})

describe('team management', () => {
  let hive: Hive | undefined
  afterEach(() => hive?.stopRouter())

  function makeHive(): { h: Hive; mail: string[] } {
    hive = new Hive(scratch())
    hive.init()
    const mail: string[] = []
    hive.on('delivered', (m) => mail.push(`${m.from}->${m.to}: ${m.body}`))
    return { h: hive, mail }
  }

  function post(h: Hive, from: string, text: string): void {
    const file = join(h.agentDir(from), 'outbox', `${Date.now()}-${Math.random()}.md`)
    writeFileSync(file, text)
    const past = new Date(Date.now() - 5000)
    utimesSync(file, past, past)
  }

  it('writes a roster with every agent and their specialty', () => {
    const { h } = makeHive()
    const roster = readFileSync(join(h.root, 'ROSTER.md'), 'utf8')
    expect(roster).toContain('`art` **Art Vandelay**: Orchestrator')
    expect(roster).toMatch(/`kramer` \*\*Kramer\*\*: Fast prototyper/)
    expect(readFileSync(join(h.agentDir('kramer'), 'ROLE.md'), 'utf8')).toContain('## Your specialty')
  })

  it('tells the orchestrator about hires, specialty changes and departures', () => {
    const { h, mail } = makeHive()
    const george = h.add({ name: 'George', command: 'claude', args: [], cwd: '', role: 'Reviewer.' })
    h.update(george.id, { role: 'QA lead.' })
    h.remove(george.id)
    expect(mail).toEqual([
      'vandelay->art: New hire: `george` George. Reviewer.',
      'vandelay->art: `george` George has a new specialty: QA lead.',
      'vandelay->art: `george` George has left the team.'
    ])
    expect(h.get('george')).toBeUndefined()
    expect(readFileSync(join(h.root, 'ROSTER.md'), 'utf8')).not.toContain('george')
  })

  it('never lets the orchestrator go, or hands out reserved ids', () => {
    const { h } = makeHive()
    expect(() => h.remove('art')).toThrow()
    expect(h.add({ name: 'HR', command: 'x', args: [], cwd: '' }).id).toBe('hr-2')
    expect(h.add({ name: 'Vandelay', command: 'x', args: [], cwd: '' }).id).toBe('vandelay-2')
  })

  it('lets the orchestrator hire and fire temps through HR', async () => {
    const { h, mail } = makeHive()
    post(h, 'art', 'to: hr\n---\nhire: Bania\nrole: Tells jokes.\nmodel: haiku')
    h.startRouter(50)
    await until(() => mail.length > 0)
    expect(mail[0]).toMatch(/^vandelay->art: Hired temp `bania`/)
    // Temps run whatever the orchestrator runs (claude here, a shell on machines without it).
    expect(h.get('bania')).toMatchObject({ temp: true, hiredBy: 'art', role: 'Tells jokes.', model: 'haiku', command: h.get('art')!.command })
    post(h, 'art', 'to: hr\n---\nfire: bania')
    await until(() => mail.length > 1)
    expect(mail[1]).toBe('vandelay->art: Let go of temp `bania`.')
    expect(h.get('bania')).toBeUndefined()
  })

  it('refuses temps from workers and beyond the limit', async () => {
    const { h, mail } = makeHive()
    post(h, 'kramer', 'to: hr\n---\nhire: Bob')
    for (const n of ['A', 'B', 'C', 'D']) post(h, 'art', `to: hr\n---\nhire: Temp ${n}`)
    h.startRouter(50)
    await until(() => mail.length >= 5)
    expect(mail).toContain('vandelay->kramer: Only the orchestrator can hire or let go of temps.')
    expect(mail.filter((m) => m.includes('Hired temp'))).toHaveLength(3)
    expect(mail.some((m) => m.includes('You already have 3 temps'))).toBe(true)
  })
})
