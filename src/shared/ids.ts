/** Mail addresses that aren't agents. No agent is ever given one of these ids. */

/** The human at the keyboard. Replies to them land in `.vandelay/you/`. */
export const YOU = 'you'
/** The app itself, as a sender: team updates and HR replies come from here. */
export const SYSTEM = 'vandelay'
/** Agents write `to: hr` to hire or let go of temps. */
export const HR = 'hr'

export const RESERVED_IDS: ReadonlySet<string> = new Set([YOU, SYSTEM, HR])

/** An agent id made from a name: `Jackie Chiles` becomes `jackie-chiles`. */
export function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'agent'
  )
}

/** The id a new agent called `name` would get, given the ids already taken. */
export function nextId(name: string, taken: (id: string) => boolean): string {
  const base = slug(name)
  let id = base
  for (let n = 2; taken(id) || RESERVED_IDS.has(id); n++) id = `${base}-${n}`
  return id
}
