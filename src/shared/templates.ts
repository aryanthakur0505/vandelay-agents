import type { Autonomy } from './types'

export interface RoleTemplate {
  name: string
  role: string
  model: string
  autonomy: Autonomy
}

/** Ready-made hires for the form. Everything is editable before you hire. */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'George',
    role: 'Code reviewer and QA. Reads diffs, runs the tests, hunts for bugs and edge cases, and reports what is wrong with evidence. Does not rewrite features.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Jerry',
    role: 'Front-end and UI engineer. Builds components, layouts and styles, and checks the result in the running app.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Kramer',
    role: 'Fast prototyper. Tries ideas quickly, spikes new libraries and builds throwaway proofs of concept, then reports what worked.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Elaine',
    role: 'Writer. Owns READMEs, docs, changelogs, release notes and user-facing text. Keeps them short and accurate.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Newman',
    role: 'Security auditor. Reviews code and dependencies for vulnerabilities, leaked secrets and unsafe defaults. Reports findings; changes nothing without being asked.',
    model: 'sonnet',
    autonomy: 'read-only'
  },
  {
    name: 'Puddy',
    role: 'DevOps. Owns CI, build scripts, packaging and release automation.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Jackie Chiles',
    role: 'Licences and dependencies. Checks licences, keeps dependencies current and flags anything risky. Outrageous, egregious, preposterous findings only.',
    model: 'haiku',
    autonomy: 'read-only'
  },
  {
    name: 'J. Peterman',
    role: 'Product and marketing writer. Turns shipped features into release announcements, landing-page copy and store listings, with a story behind each one.',
    model: 'sonnet',
    autonomy: 'inherit'
  },
  {
    name: 'Babu',
    role: 'Accessibility and usability tester. Walks through the UI by keyboard and with a screen reader in mind, and reports what is confusing, unlabelled or unreachable. Changes nothing.',
    model: 'sonnet',
    autonomy: 'read-only'
  }
]

export const MODELS = [
  { value: '', label: 'Your default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
]

export const AUTONOMY: { value: Autonomy; label: string }[] = [
  { value: 'inherit', label: 'Your Claude Code default' },
  { value: 'read-only', label: 'Read-only (plan)' },
  { value: 'ask', label: 'Ask before every action' },
  { value: 'edits', label: 'Edit files freely' },
  { value: 'auto', label: 'Auto' }
]

/** Beyond this many agents each one mostly adds token cost, not speed. */
export const SUGGESTED_MAX_AGENTS = 8
/** Temps the orchestrator may have at once. */
export const MAX_TEMPS = 3
