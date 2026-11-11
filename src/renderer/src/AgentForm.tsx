import { useEffect, useState } from 'react'
import { AUTONOMY, MODELS, ROLE_TEMPLATES, SUGGESTED_MAX_AGENTS } from '@shared/templates'
import { nextId } from '@shared/ids'
import type { AgentConfig, AgentPatch, Autonomy } from '@shared/types'

interface Props {
  /** The agent being edited; hiring when absent. */
  agent?: AgentConfig
  /** Hiring a copy of this agent: the form starts filled in from it. */
  copyOf?: AgentConfig
  /** Ids already on the team, to preview the new agent's id. */
  takenIds: string[]
  /** Hiring sends everything but the color, which the hive picks; editing can change it too. */
  onSave(input: Required<Pick<AgentPatch, 'name' | 'command' | 'args' | 'cwd'>> & AgentPatch): void
  onCancel(): void
}

/** Hire a new agent (optionally from a role template) or edit an existing one. */
export function AgentForm({ agent, copyOf, takenIds, onSave, onCancel }: Props): React.JSX.Element {
  const from = agent ?? copyOf
  const [name, setName] = useState(from?.name ?? '')
  const [role, setRole] = useState(from?.orchestrator ? '' : (from?.role ?? ''))
  const [command, setCommand] = useState(from ? [from.command, ...from.args].join(' ') : 'claude')
  const [model, setModel] = useState(from ? (from.model ?? '') : 'sonnet')
  const [autonomy, setAutonomy] = useState<Autonomy>(from?.autonomy ?? 'inherit')
  const [cwd, setCwd] = useState(from?.cwd ?? '')
  const [worktree, setWorktree] = useState(from?.worktree ?? false)
  const [color, setColor] = useState(agent?.color ?? '')
  const editing = Boolean(agent)
  const program = command.trim().split(/\s+/)[0] ?? ''
  // Check as you type (debounced) so a typo shows up before the agent fails to start.
  const [found, setFound] = useState(true)
  useEffect(() => {
    if (!program) return setFound(true)
    const t = setTimeout(() => window.vandelay.commandExists(program).then(setFound), 300)
    return () => clearTimeout(t)
  }, [program])
  const claude = /^claude(\.exe|\.cmd)?$/i.test(program)

  const applyTemplate = (index: string): void => {
    const t = ROLE_TEMPLATES[Number(index)]
    if (!t) return
    setName(t.name)
    setRole(t.role)
    setModel(t.model)
    setAutonomy(t.autonomy)
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const [cmd, ...args] = command.trim().split(/\s+/)
    if (!name.trim() || !cmd) return
    onSave({
      name: name.trim(),
      role: role.trim() || undefined,
      command: cmd,
      args,
      cwd: cwd.trim(),
      model: model || undefined,
      autonomy,
      ...(worktree && { worktree }),
      ...(editing && /^#[0-9a-f]{6}$/i.test(color) && { color })
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form className="panel agent-form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? `Edit ${agent!.name}` : copyOf ? `Hire another ${copyOf.name}` : 'Hire an agent'}</h2>
        {!editing && !copyOf && (
          <label>
            Start from a role
            <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Blank</option>
              {ROLE_TEMPLATES.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}: {t.role.split('.')[0]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="George" />
          {!editing && name.trim() && (
            <small>
              Others write to them as <code>to: {nextId(name, (id) => takenIds.includes(id))}</code>
            </small>
          )}
        </label>
        <label>
          Specialty
          <textarea
            rows={3}
            value={role}
            disabled={agent?.orchestrator}
            onChange={(e) => setRole(e.target.value)}
            placeholder={
              agent?.orchestrator ? 'The orchestrator routes work to everyone else.' : 'What this agent is good at. Art routes work by it.'
            }
          />
        </label>
        <label>
          Command
          <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="claude, codex, gemini, powershell.exe…" />
        </label>
        <div className="row">
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!claude}>
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Autonomy
            <select value={autonomy} onChange={(e) => setAutonomy(e.target.value as Autonomy)} disabled={!claude}>
              {AUTONOMY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!found && <p className="warn">Can&apos;t find &quot;{program}&quot; on your PATH. The agent won&apos;t start until it is installed.</p>}
        {!claude && <p className="hint">Model and autonomy apply to claude agents only.</p>}
        <label>
          Working folder
          <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Blank = the workspace" />
        </label>
        {editing && /^#[0-9a-f]{6}$/i.test(color) && (
          <label className="check">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /> Color on the floor and in the cards
          </label>
        )}
        <label className="check" title="Work on branch vandelay/<id> in a git worktree of its own, so it can't overwrite other agents' edits">
          <input type="checkbox" checked={worktree} onChange={(e) => setWorktree(e.target.checked)} /> Own git worktree
        </label>
        {!editing && takenIds.length >= SUGGESTED_MAX_AGENTS && (
          <p className="warn">
            You already have {takenIds.length} agents. Each claude agent uses your account&apos;s tokens; past about {SUGGESTED_MAX_AGENTS} they
            mostly add cost, not speed.
          </p>
        )}
        {editing && <p className="hint">Changes apply the next time the agent starts. Use Restart.</p>}
        <div className="actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!name.trim()}>
            {editing ? 'Save' : 'Hire'}
          </button>
        </div>
      </form>
    </div>
  )
}
