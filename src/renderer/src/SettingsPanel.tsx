import { useState } from 'react'
import { teamFile } from '@shared/team'
import type { AgentConfig } from '@shared/types'
import { errorText, FONT_SIZE } from './format'
import type { Theme } from './status'

interface Props {
  theme: Theme
  onTheme(theme: Theme): void
  sound: boolean
  onSound(on: boolean): void
  fontSize: number
  onFontSize(size: number): void
  agents: AgentConfig[]
  /** Show the claude / node / git checklist. */
  onCheckSetup(): void
  onClose(): void
}

/** Preferences that don't belong in the header. Everything here is saved per computer. */
export function SettingsPanel({ theme, onTheme, sound, onSound, fontSize, onFontSize, agents, onCheckSetup, onClose }: Props): React.JSX.Element {
  const [teamNote, setTeamNote] = useState('')
  const staff = agents.filter((a) => !a.orchestrator && !a.temp).length

  const exportTeam = async (): Promise<void> => {
    const path = await window.vandelay.saveText('vandelay-team.json', teamFile(agents))
    if (path) setTeamNote(`Saved ${staff} agents to ${path}.`)
  }
  const importTeam = async (): Promise<void> => {
    try {
      const hired = await window.vandelay.importTeam()
      if (hired) setTeamNote(hired.length ? `Hired ${hired.map((a) => a.name).join(', ')}.` : 'That team file has nobody in it.')
    } catch (err) {
      setTeamNote(errorText(err))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="panel agent-form settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <h3>Display</h3>
        <label>
          Theme
          <select autoFocus value={theme} onChange={(e) => onTheme(e.target.value as Theme)}>
            <option value="control">Control room</option>
            <option value="office">Office</option>
          </select>
        </label>
        <label>
          Terminal text size ({fontSize}px, also Ctrl + mouse wheel)
          <input type="range" min={FONT_SIZE.min} max={FONT_SIZE.max} value={fontSize} onChange={(e) => onFontSize(Number(e.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={sound} onChange={(e) => onSound(e.target.checked)} /> A short blip for each message
        </label>

        <h3>Team</h3>
        <p className="hint">
          Save everyone except Art and temps (names, specialties, commands, models, autonomy) to reuse in another workspace or share with someone.
        </p>
        <div className="row">
          <button type="button" onClick={exportTeam} disabled={staff === 0}>
            Export team…
          </button>
          <button type="button" onClick={importTeam}>
            Import team…
          </button>
        </div>
        {teamNote && <p className="hint">{teamNote}</p>}

        <h3>Troubleshooting</h3>
        <p className="hint">The app logs errors and start-ups to a file. Attach it when you report a bug.</p>
        <div className="row">
          <button type="button" onClick={() => window.vandelay.openLogs()}>
            Open logs folder
          </button>
          <button type="button" onClick={onCheckSetup}>
            Check setup
          </button>
        </div>

        <div className="actions">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
