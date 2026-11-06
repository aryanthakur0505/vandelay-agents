import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { AgentConfig, HiveMessage, VandelayApi } from '@shared/types'

function listen<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: VandelayApi = {
  workspace: () => ipcRenderer.invoke(IPC.workspace),
  changeWorkspace: () => ipcRenderer.invoke(IPC.workspaceChange),
  saveText: (defaultName, text) => ipcRenderer.invoke(IPC.saveText, defaultName, text),
  commandExists: (command) => ipcRenderer.invoke(IPC.commandExists, command),
  listAgents: () => ipcRenderer.invoke(IPC.agentsList),
  addAgent: (agent) => ipcRenderer.invoke(IPC.agentsAdd, agent),
  updateAgent: (id, patch) => ipcRenderer.invoke(IPC.agentsUpdate, id, patch),
  removeAgent: (id) => ipcRenderer.invoke(IPC.agentsRemove, id),
  startAgent: (id, cols, rows) => ipcRenderer.invoke(IPC.agentsStart, id, cols, rows),
  stopAgent: (id) => ipcRenderer.invoke(IPC.agentsStop, id),
  openAgent: (id, file) => ipcRenderer.invoke(IPC.agentsOpen, id, file),
  write: (id, data) => ipcRenderer.send(IPC.ptyWrite, id, data),
  resize: (id, cols, rows) => ipcRenderer.send(IPC.ptyResize, id, cols, rows),
  sendMessage: (to, body) => ipcRenderer.invoke(IPC.hiveSend, to, body),
  broadcast: (body) => ipcRenderer.invoke(IPC.hiveBroadcast, body),
  history: () => ipcRenderer.invoke(IPC.hiveHistory),
  onData: (cb) => listen<[string, string]>(IPC.ptyData, cb),
  onExit: (cb) => listen<[string, number]>(IPC.ptyExit, cb),
  onDelivered: (cb) => listen<[HiveMessage]>(IPC.hiveDelivered, cb),
  onRoster: (cb) => listen<[AgentConfig[]]>(IPC.agentsRoster, cb)
}

contextBridge.exposeInMainWorld('vandelay', api)
