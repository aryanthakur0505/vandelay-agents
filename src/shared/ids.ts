/** Mail addresses that aren't agents. No agent is ever given one of these ids. */

/** The human at the keyboard. Replies to them land in `.vandelay/you/`. */
export const YOU = 'you'
/** The app itself, as a sender: team updates and HR replies come from here. */
export const SYSTEM = 'vandelay'
/** Agents write `to: hr` to hire or let go of temps. */
export const HR = 'hr'

export const RESERVED_IDS: ReadonlySet<string> = new Set([YOU, SYSTEM, HR])
