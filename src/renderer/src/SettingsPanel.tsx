import { FONT_SIZE } from './format'
import type { Theme } from './status'

interface Props {
  theme: Theme
  onTheme(theme: Theme): void
  sound: boolean
  onSound(on: boolean): void
  fontSize: number
  onFontSize(size: number): void
  onClose(): void
}

/** Preferences that don't belong in the header. Everything here is saved per computer. */
export function SettingsPanel({ theme, onTheme, sound, onSound, fontSize, onFontSize, onClose }: Props): React.JSX.Element {
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

        <div className="actions">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
