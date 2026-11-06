import { clock, time } from './format'

interface Props {
  online: number
  total: number
  routed: number
  uptimeMs: number
  now: number
}

/** The header readout: units online, packets routed, uptime and the clock. */
export function StatusBar({ online, total, routed, uptimeMs, now }: Props): React.JSX.Element {
  return (
    <dl className="stats">
      <div title="Agents whose terminal is running">
        <dt>Units online</dt>
        <dd>
          {online}/{total}
        </dd>
      </div>
      <div title="Messages delivered since the app started">
        <dt>Packets routed</dt>
        <dd>{routed}</dd>
      </div>
      <div title="Time since the app started">
        <dt>Uptime</dt>
        <dd>{clock(uptimeMs)}</dd>
      </div>
      <div>
        <dt>Clock</dt>
        <dd>{time(now)}</dd>
      </div>
    </dl>
  )
}
