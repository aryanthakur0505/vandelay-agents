import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Notification, screen, shell } from 'electron'
import { YOU } from '@shared/ids'
import { IPC } from '@shared/ipc'
import { isQuestion } from '@shared/messages'
import { parseTeamFile } from '@shared/team'
import type { AgentConfig, AgentFile, HiveMessage, StuckMail } from '@shared/types'
import { claudeArgs, claudeHookArgs, isClaude, stopOrphans } from './claudeHooks'
import { Hive } from './hive'
import { findExecutable, isShell, Terminals } from './terminals'
import { askForWorkspace, chooseWorkspace, relaunchArgs } from './workspace'
import { DEFAULT_SIZE, loadWindowState, MIN_SIZE, saveWindowState, usableBounds } from './windowState'
import * as check from './ipcGuards'
import { initLog, log } from './log'
import { ensureWorktree } from './worktrees'

// Opt-in Chrome DevTools Protocol port, handy for driving the UI from scripts.
if (process.env.VANDELAY_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.VANDELAY_DEBUG_PORT)

// Both are set once the app is ready, before anything uses them.
let workspace = ''
let hive: Hive
const terminals = new Terminals()
/** Agents whose mail arrives through Claude Code hooks rather than typed nudges. */
const hooked = new Set<string>()
/** How long a hooked agent's mail watcher gets to pick up new mail before we type a prompt instead. */
const WATCHER_GRACE_MS = 5000
let win: BrowserWindow | null = null

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

function createWindow(): void {
  const stateFile = join(app.getPath('userData'), 'window.json')
  const saved = loadWindowState(stateFile)
  const bounds = usableBounds(
    saved?.bounds,
    screen.getAllDisplays().map((d) => d.workArea)
  )
  win = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    title: 'Vandelay Agents',
    // The control-room background, the default theme, so the window doesn't flash brown on load.
    backgroundColor: '#04080d',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The renderer gets no Node.js at all: everything it can do goes through the preload bridge,
      // whose bundle only needs `electron`, so it runs in Chromium's sandbox.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (bounds && saved?.maximized) win.maximize()
  // Remember where the window was, so it opens there next time.
  const w = win
  w.on('close', () => saveWindowState(stateFile, { bounds: w.getNormalBounds(), maximized: w.isMaximized() }))

  // The window only ever shows the app. A link or a dropped file would otherwise replace it, with the
  // preload bridge still attached, so open web links in the browser and ignore everything else.
  win.webContents.on('will-navigate', (e, url) => {
    if (url === win?.webContents.getURL()) return
    e.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Only web links: openExternal on a file: or custom-scheme URL could launch a program.
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function agentEnv(agent: AgentConfig): Record<string, string> {
  return {
    VANDELAY_AGENT: agent.id,
    VANDELAY_HIVE: hive.root,
    VANDELAY_AGENT_DIR: hive.agentDir(agent.id),
    TERM_PROGRAM: 'vandelay-agents'
  }
}

/** Points at the whole inbox rather than one file, so a coalesced nudge still covers every message. */
function nudgeText(agent: AgentConfig, msg: HiveMessage): string {
  const role = agent.orchestrator ? ` Your role is in ${join(hive.agentDir(agent.id), 'ROLE.md')}.` : ''
  return (
    `You are ${agent.name}, an agent in Vandelay Agents. You have new mail (latest from ${msg.from}). ` +
    `Read every file in ${dirname(msg.file)}, act on each, then move it to archive/. ` +
    `The messaging protocol is in ${join(hive.root, 'PROTOCOL.md')}.${role}`
  )
}

/** Replies to the human are easy to miss while you're in another window, so raise a notification. */
function notifyHuman(msg: HiveMessage): void {
  if (!win || win.isDestroyed() || win.isFocused() || !Notification.isSupported()) return
  const who = hive.get(msg.from)?.name ?? msg.from
  // A question needs you, so say so; anything else is a report.
  const title = isQuestion(msg) ? `${who} asks you` : `${who} replied`
  const n = new Notification({ title, body: msg.body.slice(0, 200) })
  n.on('click', () => {
    win?.show()
    win?.focus()
  })
  n.show()
  win.flashFrame(true)
}

/** The agent's working folder: its own git worktree when it asks for one, else its cwd or the workspace. */
async function agentCwd(agent: AgentConfig): Promise<string> {
  if (!agent.worktree) return agent.cwd || workspace
  const dir = hive.worktreeDir(agent.id)
  try {
    await ensureWorktree(agent.cwd || workspace, dir, agent.id)
    return dir
  } catch (err) {
    send(IPC.ptyData, agent.id, `\x1b[33mNo worktree (${(err as Error).message}); working in the workspace.\x1b[0m\r\n`)
    return agent.cwd || workspace
  }
}

function wire(): void {
  terminals.on('data', (id: string, data: string) => send(IPC.ptyData, id, data))
  terminals.on('exit', (id: string, code: number) => {
    // Removing the lock tells any mail watcher the dead session left behind to stop.
    rmSync(join(hive.agentDir(id), '.watcher'), { force: true })
    send(IPC.ptyExit, id, code)
  })

  hive.on('delivered', (msg: HiveMessage) => {
    send(IPC.hiveDelivered, msg)
    if (msg.to === YOU) return notifyHuman(msg)
    const agent = hive.get(msg.to)
    if (!agent || !terminals.isRunning(agent.id) || isShell(agent.command)) return
    // Other CLIs get the prompt typed in.
    if (!hooked.has(agent.id)) return terminals.nudge(agent.id, nudgeText(agent, msg))
    // A live mail watcher files new mail within a second. If the mail is still waiting, the
    // watcher has died (its timeout ran out, say), so fall back to typing the prompt.
    setTimeout(() => {
      if (existsSync(msg.file) && terminals.isRunning(agent.id)) terminals.nudge(agent.id, nudgeText(agent, msg))
    }, WATCHER_GRACE_MS)
  })

  ipcMain.handle(IPC.workspace, () => workspace)
  ipcMain.handle(IPC.logOpen, async () => {
    await shell.openPath(app.getPath('logs'))
  })
  ipcMain.handle(IPC.commandExists, (_e, command: unknown) => {
    const name = check.text(command, 'command', 1000).trim()
    return Boolean(name && findExecutable(name))
  })
  ipcMain.handle(IPC.saveText, async (_e, rawName: unknown, rawText: unknown) => {
    const defaultName = check.text(rawName, 'file name', 255)
    const text = check.text(rawText, 'text', 50_000_000)
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: join(workspace, basename(defaultName)),
      filters: [extname(defaultName) === '.json' ? { name: 'JSON', extensions: ['json'] } : { name: 'Markdown', extensions: ['md'] }]
    })
    if (canceled || !filePath) return null
    writeFileSync(filePath, text)
    return filePath
  })
  ipcMain.handle(IPC.workspaceChange, () => {
    const dir = askForWorkspace()
    if (!dir) return
    // The hive, router and terminals all belong to one workspace, so start over in the new one.
    terminals.stopAll()
    app.relaunch({ args: relaunchArgs(dir) })
    app.exit(0)
  })
  hive.on('roster', (agents: AgentConfig[]) => send(IPC.agentsRoster, agents))
  hive.on('removed', (id: string) => {
    terminals.stop(id)
    hooked.delete(id)
  })

  ipcMain.handle(IPC.agentsList, () => hive.list())
  ipcMain.handle(IPC.agentsAdd, (_e, input: unknown) => hive.add(check.agentInput(input)))
  ipcMain.handle(IPC.agentsUpdate, (_e, id: unknown, patch: unknown) => hive.update(check.text(id, 'id', 100), check.agentPatch(patch)))
  ipcMain.handle(IPC.teamImport, async () => {
    // The file is picked and read here, so the renderer never names a path to read.
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Import a team',
      defaultPath: workspace,
      filters: [{ name: 'Vandelay team', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return null
    return hive.importTeam(parseTeamFile(readFileSync(filePaths[0], 'utf8')))
  })
  ipcMain.handle(IPC.agentsRemove, (_e, id: unknown) => hive.remove(check.text(id, 'id', 100)))
  const starting = new Set<string>()
  ipcMain.handle(IPC.agentsStart, async (_e, rawId: unknown, rawCols: unknown, rawRows: unknown) => {
    const id = check.text(rawId, 'id', 100)
    const cols = check.int(rawCols, 'cols', 1, 2000)
    const rows = check.int(rawRows, 'rows', 1, 1000)
    const agent = hive.get(id)
    if (!agent) throw new Error(`Unknown agent ${id}`)
    if (terminals.isRunning(id)) return terminals.resize(id, cols, rows)
    if (starting.has(id)) return
    starting.add(id)
    try {
      const claude = isClaude(agent.command)
      if (claude) await stopOrphans(hive.agentDir(id))
      const cwd = await agentCwd(agent)
      const hookArgs = claude ? claudeHookArgs(hive.root, agent, hive.agentDir(id)) : null
      if (hookArgs) hooked.add(id)
      else hooked.delete(id)
      const extra = claude ? [...claudeArgs(agent), ...(hookArgs ?? [])] : []
      terminals.start(agent, cwd, agentEnv(agent), cols, rows, extra)
    } finally {
      starting.delete(id)
    }
  })
  ipcMain.handle(IPC.agentsStop, (_e, id: unknown) => terminals.stop(check.text(id, 'id', 100)))
  const OPENABLE: readonly AgentFile[] = ['memory.md', 'ROLE.md']
  const STUCK_KINDS: readonly StuckMail['kind'][] = ['held', 'dead-letter']
  ipcMain.handle(IPC.agentsOpen, async (_e, rawId: unknown, rawFile: unknown) => {
    // Only known agents and known files: the renderer never gets to open an arbitrary path.
    const id = check.text(rawId, 'id', 100)
    const file = rawFile === undefined ? undefined : check.oneOf(rawFile, 'file', OPENABLE)
    if (!hive.get(id)) return
    const error = await shell.openPath(file ? join(hive.agentDir(id), file) : hive.agentDir(id))
    if (error) log.warn('could not open', id, file, error)
  })
  ipcMain.handle(IPC.hiveSend, (_e, to: unknown, body: unknown) => {
    hive.deliver(YOU, check.text(to, 'recipient', 100), check.text(body, 'message'))
  })
  ipcMain.handle(IPC.hiveHistory, () => hive.history())
  ipcMain.handle(IPC.hiveStuck, () => hive.stuckMail())
  ipcMain.handle(IPC.hiveRelease, (_e, kind: unknown, file: unknown) => {
    hive.releaseStuck(check.oneOf(kind, 'kind', STUCK_KINDS), check.text(file, 'file', 300))
  })
  ipcMain.handle(IPC.hiveDiscard, (_e, kind: unknown, file: unknown) =>
    hive.discardStuck(check.oneOf(kind, 'kind', STUCK_KINDS), check.text(file, 'file', 300))
  )
  hive.on('stuck', () => send(IPC.hiveStuckChanged))
  ipcMain.handle(IPC.hiveBroadcast, (_e, body: unknown) => {
    hive.broadcast(YOU, check.text(body, 'message'))
  })
  // Fire-and-forget channels: a bad message is dropped, since throwing here has nowhere to go.
  ipcMain.on(IPC.logError, (_e, message: unknown) => {
    if (typeof message === 'string') log.error('[renderer]', message.slice(0, 10_000))
  })
  ipcMain.on(IPC.ptyWrite, (_e, id: unknown, data: unknown) => {
    if (typeof id === 'string' && typeof data === 'string') terminals.write(id, data)
  })
  ipcMain.on(IPC.ptyResize, (_e, id: unknown, cols: unknown, rows: unknown) => {
    if (typeof id === 'string' && Number.isInteger(cols) && Number.isInteger(rows)) terminals.resize(id, cols as number, rows as number)
  })
}

// Anything that slips through ends up in the log rather than vanishing (or killing the app silently).
process.on('uncaughtException', (err) => log.error('uncaught', err))
process.on('unhandledRejection', (err) => log.error('unhandled rejection', err))

app.whenReady().then(() => {
  initLog(app.getPath('logs'))
  log.info(`Vandelay Agents ${app.getVersion()} on ${process.platform} ${process.arch}`)
  const chosen = chooseWorkspace()
  if (!chosen) return app.quit()
  workspace = chosen
  hive = new Hive(workspace)
  hive.init()
  hive.startRouter()
  wire()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  terminals.stopAll()
  hive?.stopRouter()
  if (process.platform !== 'darwin') app.quit()
})
