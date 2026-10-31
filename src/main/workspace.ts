import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, dialog } from 'electron'

function storeFile(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

const FLAG = '--workspace='

export function askForWorkspace(): string | null {
  const picked = dialog.showOpenDialogSync({
    title: 'Choose the folder your agents work in',
    properties: ['openDirectory', 'createDirectory']
  })
  if (!picked?.[0]) return null
  writeFileSync(storeFile(), JSON.stringify({ workspace: picked[0] }))
  return picked[0]
}

/**
 * The folder agents work in: a `--workspace=` flag (set when you switch folders), VANDELAY_WORKSPACE,
 * else the folder `npm run dev` ran in. An installed app starts somewhere arbitrary, so it remembers
 * the folder you last chose and asks the first time. Null means you cancelled.
 */
export function chooseWorkspace(): string | null {
  const flag = process.argv.find((a) => a.startsWith(FLAG))
  if (flag) return flag.slice(FLAG.length)
  if (process.env.VANDELAY_WORKSPACE) return process.env.VANDELAY_WORKSPACE
  if (!app.isPackaged) return process.cwd()
  try {
    const { workspace } = JSON.parse(readFileSync(storeFile(), 'utf8'))
    if (typeof workspace === 'string' && existsSync(workspace)) return workspace
  } catch {
    // Nothing saved yet.
  }
  return askForWorkspace()
}

/** Arguments that relaunch the app in another workspace. */
export function relaunchArgs(dir: string): string[] {
  return [...process.argv.slice(1).filter((a) => !a.startsWith(FLAG)), FLAG + dir]
}
