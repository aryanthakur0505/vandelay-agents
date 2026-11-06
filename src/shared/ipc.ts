/** IPC channel names, shared by the main process and the preload bridge so they can't drift apart. */
export const IPC = {
  workspace: 'workspace',
  workspaceChange: 'workspace:change',
  saveText: 'save-text',
  agentsList: 'agents:list',
  agentsAdd: 'agents:add',
  agentsUpdate: 'agents:update',
  agentsRemove: 'agents:remove',
  agentsStart: 'agents:start',
  agentsStop: 'agents:stop',
  agentsRoster: 'agents:roster',
  agentsOpen: 'agents:open',
  hiveSend: 'hive:send',
  hiveBroadcast: 'hive:broadcast',
  hiveDelivered: 'hive:delivered',
  hiveHistory: 'hive:history',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit'
} as const
