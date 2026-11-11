import { useEffect, useState } from 'react'
import type { SetupStatus } from '@shared/types'

interface Props {
  onClose(): void
}

interface Item {
  label: string
  ok: boolean
  /** Shown when it's fine: where it was found, or what it means. */
  detail: string
  /** Shown when it's missing: why it matters. */
  why: string
  link?: { text: string; url: string }
  /** Missing it only limits something, rather than stopping agents. */
  optional?: boolean
}

function items(s: SetupStatus): Item[] {
  return [
    {
      label: 'Claude Code (claude)',
      ok: Boolean(s.claude),
      detail: s.claude ?? '',
      why: 'Agents run it. Without it they start as plain shells. Install it, sign in once in a terminal, then restart the app.',
      link: { text: 'Install Claude Code', url: 'https://docs.claude.com/en/docs/claude-code' }
    },
    {
      label: 'Node.js (node)',
      ok: Boolean(s.node),
      detail: s.node ?? '',
      why: "Claude agents' mail hook runs on it. Without it, mail is typed into their terminals instead, which is slower and less reliable.",
      link: { text: 'Install Node.js', url: 'https://nodejs.org' }
    },
    {
      label: 'git',
      ok: Boolean(s.git),
      detail: s.git ?? '',
      why: 'Needed only for giving agents their own git worktree.',
      link: { text: 'Install git', url: 'https://git-scm.com/downloads' },
      optional: true
    },
    {
      label: 'Workspace is a git repository',
      ok: s.workspaceIsGit,
      detail: 'Agents can work on branches of their own.',
      why: 'Fine for trying things out. To give agents their own worktrees, pick a folder that is a git repository (header → change).',
      optional: true
    }
  ]
}

/** A first-run checklist: what's installed, what's missing, and what each one is for. */
export function SetupCheck({ onClose }: Props): React.JSX.Element {
  const [status, setStatus] = useState<SetupStatus>()
  useEffect(() => {
    window.vandelay.setupStatus().then(setStatus)
  }, [])

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="panel agent-form setup" role="dialog" aria-label="Setup check" onClick={(e) => e.stopPropagation()}>
        <h2>Setup check</h2>
        {!status && <p className="hint">Checking…</p>}
        {status && (
          <ul className="checklist">
            {items(status).map((item) => (
              <li key={item.label} className={item.ok ? 'ok' : item.optional ? 'maybe' : 'missing'}>
                <b>
                  {item.ok ? '✔' : item.optional ? '○' : '✘'} {item.label}
                </b>
                <p className="hint">{item.ok ? item.detail : item.why}</p>
                {!item.ok && item.link && (
                  <a href={item.link.url} target="_blank" rel="noreferrer">
                    {item.link.text}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="actions">
          <button type="button" className="primary" autoFocus onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
