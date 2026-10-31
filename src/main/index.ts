import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AgentConfig, HiveMessage } from '@shared/types'
import { Hive } from './hive'
import { isShell, Terminals } from './terminals'

// Opt-in Chrome DevTools Protocol port, handy for driving the UI from scripts.
if (process.env.VANDELAY_DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', process.env.VANDELAY_DEBUG_PORT)

const workspace = process.env.VANDELAY_WORKSPACE || process.cwd()
const hive = new Hive(workspace)
const terminals = new Terminals()
let win: BrowserWindow | null = null

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args)
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Vandelay Agents',
    backgroundColor: '#1d1b1a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
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

function nudgeText(agent: AgentConfig, msg: HiveMessage): string {
  const role = agent.orchestrator ? ` Your role is in ${join(hive.agentDir(agent.id), 'ROLE.md')}.` : ''
  return (
    `You are ${agent.name}, an agent in Vandelay Agents. New message from ${msg.from} in ${msg.file}. ` +
    `Read it and act on it. The messaging protocol is in ${join(hive.root, 'PROTOCOL.md')}.${role}`
  )
}

function wire(): void {
  terminals.on('data', (id: string, data: string) => send('pty:data', id, data))
  terminals.on('exit', (id: string, code: number) => send('pty:exit', id, code))

  hive.on('delivered', (msg: HiveMessage) => {
    send('hive:delivered', msg)
    const agent = hive.get(msg.to)
    if (agent && terminals.isRunning(agent.id) && !isShell(agent.command)) terminals.nudge(agent.id, nudgeText(agent, msg))
  })

  ipcMain.handle('workspace', () => workspace)
  ipcMain.handle('agents:list', () => hive.list())
  ipcMain.handle('agents:add', (_e, input: Omit<AgentConfig, 'id' | 'color'>) => hive.add(input))
  ipcMain.handle('agents:start', (_e, id: string, cols: number, rows: number) => {
    const agent = hive.get(id)
    if (!agent) throw new Error(`Unknown agent ${id}`)
    terminals.start(agent, agent.cwd || workspace, agentEnv(agent), cols, rows)
  })
  ipcMain.handle('agents:stop', (_e, id: string) => terminals.stop(id))
  ipcMain.handle('hive:send', (_e, to: string, body: string) => {
    hive.deliver('you', to, body)
  })
  ipcMain.on('pty:write', (_e, id: string, data: string) => terminals.write(id, data))
  ipcMain.on('pty:resize', (_e, id: string, cols: number, rows: number) => terminals.resize(id, cols, rows))
}

app.whenReady().then(() => {
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
  hive.stopRouter()
  if (process.platform !== 'darwin') app.quit()
})
