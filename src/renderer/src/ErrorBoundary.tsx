import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * If a component throws, show what happened and a way out instead of a blank window. The agents
 * keep running in the main process meanwhile, so reloading the window loses nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    window.vandelay.reportError(`${error.stack ?? error.message}\n${info.componentStack ?? ''}`)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Something broke in the window.</h1>
        <p>Your agents are still running. Reload the window to carry on; the details are in the log.</p>
        <pre>{this.state.error.message}</pre>
        <div className="actions">
          <button className="primary" onClick={() => window.location.reload()}>
            Reload window
          </button>
          <button onClick={() => window.vandelay.openLogs()}>Open logs</button>
        </div>
      </div>
    )
  }
}
