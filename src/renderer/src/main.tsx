import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { App } from './App'

// Errors that escape React still reach the log file, where a bug report can quote them.
window.addEventListener('error', (e) => window.vandelay.reportError(e.error?.stack ?? e.message))
window.addEventListener('unhandledrejection', (e) => window.vandelay.reportError(String(e.reason?.stack ?? e.reason)))

createRoot(document.getElementById('root')!).render(<App />)
