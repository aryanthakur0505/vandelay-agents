import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { HiveMessage, VandelayApi } from '@shared/types'

function listen<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: VandelayApi = {
  workspace: () => ipcRenderer.invoke('workspace'),
  listAgents: () => ipcRenderer.invoke('agents:list'),
  addAgent: (agent) => ipcRenderer.invoke('agents:add', agent),
  startAgent: (id, cols, rows) => ipcRenderer.invoke('agents:start', id, cols, rows),
  stopAgent: (id) => ipcRenderer.invoke('agents:stop', id),
  write: (id, data) => ipcRenderer.send('pty:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  sendMessage: (to, body) => ipcRenderer.invoke('hive:send', to, body),
  onData: (cb) => listen<[string, string]>('pty:data', cb),
  onExit: (cb) => listen<[string, number]>('pty:exit', cb),
  onDelivered: (cb) => listen<[HiveMessage]>('hive:delivered', cb)
}

contextBridge.exposeInMainWorld('vandelay', api)
