import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Notification, screen, shell } from 'electron'
import { YOU } from '@shared/ids'
import { IPC } from '@shared/ipc'
import { isQuestion } from '@shared/messages'
import type { AgentConfig, AgentFile, AgentInput, HiveMessage } from '@shared/types'
import { claudeArgs, claudeHookArgs, isClaude, stopOrphans } from './claudeHooks'
import { Hive } from './hive'
import { findExecutable, isShell, Terminals } from './terminals'
import { askForWorkspace, chooseWorkspace, relaunchArgs } from './workspace'
import { DEFAULT_SIZE, loadWindowState, MIN_SIZE, saveWindowState, usableBounds } from './windowState'
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
      contextIsolation: true,
      sandbox: false
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
  ipcMain.handle(IPC.commandExists, (_e, command: string) => Boolean(command.trim() && findExecutable(command.trim())))
  ipcMain.handle(IPC.saveText, async (_e, defaultName: string, text: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: join(workspace, basename(defaultName)),
      filters: [{ name: 'Markdown', extensions: ['md'] }]
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
  ipcMain.handle(IPC.agentsAdd, (_e, input: AgentInput) => hive.add(input))
  ipcMain.handle(IPC.agentsUpdate, (_e, id: string, patch: Partial<AgentInput>) => hive.update(id, patch))
  ipcMain.handle(IPC.agentsRemove, (_e, id: string) => hive.remove(id))
  const starting = new Set<string>()
  ipcMain.handle(IPC.agentsStart, async (_e, id: string, cols: number, rows: number) => {
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
  ipcMain.handle(IPC.agentsStop, (_e, id: string) => terminals.stop(id))
  const OPENABLE: AgentFile[] = ['memory.md', 'ROLE.md']
  ipcMain.handle(IPC.agentsOpen, async (_e, id: string, file?: AgentFile) => {
    // Only known agents and known files: the renderer never gets to open an arbitrary path.
    if (!hive.get(id) || (file && !OPENABLE.includes(file))) return
    const error = await shell.openPath(file ? join(hive.agentDir(id), file) : hive.agentDir(id))
    if (error) console.error('[vandelay] could not open', id, file, error)
  })
  ipcMain.handle(IPC.hiveSend, (_e, to: string, body: string) => {
    hive.deliver(YOU, to, body)
  })
  ipcMain.handle(IPC.hiveHistory, () => hive.history())
  ipcMain.handle(IPC.hiveBroadcast, (_e, body: string) => {
    hive.broadcast(YOU, body)
  })
  ipcMain.on(IPC.ptyWrite, (_e, id: string, data: string) => terminals.write(id, data))
  ipcMain.on(IPC.ptyResize, (_e, id: string, cols: number, rows: number) => terminals.resize(id, cols, rows))
}

app.whenReady().then(() => {
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
