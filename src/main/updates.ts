import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { log } from './log'

const { autoUpdater } = electronUpdater

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

/**
 * Looks for a newer release on GitHub at start-up and every six hours, downloads it in the
 * background, and calls `onReady` with its version; it installs when you restart or quit.
 * Only installed builds update. macOS won't install an update into an unsigned app, so there the app
 * leaves updating to you until releases are signed.
 */
export function startUpdates(onReady: (version: string) => void): void {
  if (!app.isPackaged || process.platform === 'darwin' || process.env.VANDELAY_NO_UPDATES) return
  autoUpdater.logger = {
    info: (m) => log.info('[update]', m),
    warn: (m) => log.warn('[update]', m),
    error: (m) => log.error('[update]', m),
    debug: () => {}
  }
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', (info) => onReady(info.version))
  const check = (): void => void autoUpdater.checkForUpdates().catch((err) => log.warn('[update] check failed', err))
  check()
  setInterval(check, CHECK_EVERY_MS).unref()
}

/** Restarts into the downloaded update. */
export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
