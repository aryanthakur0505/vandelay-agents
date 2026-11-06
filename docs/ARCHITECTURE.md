# Architecture

Vandelay Agents is an Electron app with the usual three processes. Everything that touches the
disk, processes or the network lives in the main process; the renderer only draws and asks.

```
renderer (React)  ──window.vandelay──►  preload  ──IPC──►  main
  App, Floor, terminals                 the typed bridge     Hive (router), Terminals (PTYs),
  composer, comms log                                       claude hooks, worktrees, dialogs
```

## Main process (`src/main`)

| File | Owns |
| --- | --- |
| `index.ts` | the window, IPC handlers, wiring hive events to terminals and the renderer |
| `hive.ts` | the roster (`agents.json`, `ROSTER.md`), agent folders, the router, HR, history |
| `terminals.ts` | one `node-pty` process per agent, typed nudges for non-hooked CLIs |
| `claudeHooks.ts` | `--settings` for claude agents: the SessionStart context and mail watcher |
| `hooks/claude-mail-hook.cjs` | the hook script itself, copied into the hive at start-up |
| `worktrees.ts` | a git worktree per agent on `vandelay/<id>` |
| `workspace.ts` | which folder the agents work in |
| `windowState.ts` | remembering the window's size and position |

### Mail

Mail is plain Markdown files, so agents need nothing but file access to talk to each other:

1. An agent writes `to: <id>` / `---` / body into its `outbox/`.
2. The router (`Hive.route`, every second) picks up files older than half a second, so it never
   reads a half-written file, and moves each into the recipient's `inbox/` with a
   `from:`/`to:`/`at:` header. The sender's copy goes to its `archive/` as `sent-*`.
3. Unknown recipients go to `dead-letter/` and the sender gets a notice. Two agents trading more
   than `LOOP_LIMIT` messages a minute have their mail parked in `held/`, and you get a notice.
4. A claude agent's mail watcher (an `asyncRewake` hook) sees the new inbox file, moves it to
   `archive/`, and exits with code 2 and the message on stderr, which wakes Claude. Other CLIs get a
   prompt typed into their terminal once it has been quiet for two seconds.

Every delivery is an event (`delivered`) that the main process forwards to the renderer for the
floor animation and the comms log. On start-up the renderer asks for `history()`, which reads the
latest delivered files back from disk.

### Special addresses

`you` (the human), `vandelay` (the app's own notices) and `hr` (hiring temps) are defined in
`src/shared/ids.ts` and can never be an agent's id.

## Preload (`src/preload`)

`index.ts` exposes `window.vandelay`, typed as `VandelayApi` in `src/shared/types.ts`. Channel
names come from `src/shared/ipc.ts`, so the two sides can't drift apart.

## Renderer (`src/renderer/src`)

| File | Draws |
| --- | --- |
| `App.tsx` | state and layout: roster, statuses, traffic, the selected agent |
| `Floor.tsx` | the canvas floor, in the control-room or office theme |
| `UnitCards.tsx`, `TermBar.tsx`, `AgentTerminal.tsx` | the right-hand side: cards, toolbar, xterm |
| `Composer.tsx`, `CommsLog.tsx` | briefing agents and reading their traffic |
| `AgentForm.tsx` | hiring and editing |

Pure helpers (`format.ts`, `commsFilter.ts`, `commsExport.ts`, `briefHistory.ts`, `status.ts`) have
unit tests in `test/`.
