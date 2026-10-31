# Vandelay Agents

**Importer and exporter of work.** Vandelay Agents is a desktop app that runs the terminal coding
CLIs you already use (`claude`, `codex`, `gemini`, or any shell command) as a team of agents. Each
agent gets a real terminal, an inbox, an outbox and a memory file, and sits at a desk on a 2D office
floor. Art Vandelay, the orchestrator, takes your brief and routes the work to everyone else.

> A Seinfeld parody. Not affiliated with Seinfeld, NBC or Castle Rock. All code and art here are
> original.

*Electron · React · TypeScript · electron-vite · xterm.js · node-pty*

## Status

Milestone 1 (MVP):

- [x] One real PTY per agent (`node-pty`), rendered with xterm.js. You can type into any of them.
- [x] A file-based hive: per-agent `inbox/`, `outbox/`, `archive/` and `memory.md`.
- [x] A router that moves outbox messages into the recipient's inbox, and nudges agent CLIs when
      mail arrives.
- [x] A 2D floor drawn in code: desks, avatars, status lights, unread envelopes and envelopes flying
      between desks.
- [x] Add agents from the UI. Agents are saved to `.vandelay/agents.json`.

Later: voice, Slack, approvals, budgets, semantic memory, per-agent git worktrees, walking avatars.

## Getting started

### Prerequisites

- Node.js 18 or newer, and npm.
- `node-pty` 1.1 ships N-API prebuilds for Windows (x64, arm64) and macOS, so no compiler is needed
  there. On Linux, or if the prebuild fails to load, install a C/C++ toolchain (`build-essential` and
  Python 3; on Windows, Visual Studio Build Tools with "Desktop development with C++").
- Optional: an agent CLI on your `PATH` (`claude`, `codex`, `gemini`, …). Without one, agents run
  your normal shell.

### Run

```bash
npm install
npm run dev     # opens the app with hot reload
```

Other scripts: `npm run build`, `npm run preview` and `npm run typecheck`.

Set `VANDELAY_DEBUG_PORT=9333` before `npm run dev` to expose the Chrome DevTools Protocol, which
lets scripts inspect or screenshot the UI.

## How it works

```
 you ──► Art Vandelay (orchestrator) ──outbox──► router ──► kramer/inbox ──► Kramer's terminal
                    ▲                                                            │
                    └─────────────── router ◄── kramer/outbox ◄──────────────────┘
```

The workspace is the folder the app was started from, or `VANDELAY_WORKSPACE` if set. The hive lives
in `<workspace>/.vandelay/`:

```
.vandelay/
  agents.json          the roster
  PROTOCOL.md          how agents message each other
  you/                 replies addressed to you
  dead-letter/         messages with an unknown recipient
  agents/<id>/
    inbox/  outbox/  archive/  memory.md
```

To message another agent, an agent writes a `.md` file to its own `outbox/`:

```
to: kramer
---
Write tests for src/parser.ts and reply when done.
```

The router checks outboxes every second and moves each message to the recipient's inbox. Messages
you send from the composer go straight into the chosen agent's inbox. How the recipient finds out
depends on what it runs:

- **`claude` agents** are started with `--settings .vandelay/agents/<id>/claude-settings.json`,
  which adds two Claude Code hooks (merged with your own settings, nothing of yours is edited). A
  `SessionStart` hook tells Claude who it is and how the protocol works. An `asyncRewake` watcher,
  armed at session start and after every turn, waits for new inbox files and exits with code 2,
  which wakes Claude even when it is idle. Nothing is typed into the terminal, so dialogs and
  permission prompts are never answered by accident. The hook script runs on `node`; without Node
  on `PATH`, claude agents fall back to typed prompts.
- **Other agent CLIs** get a short prompt typed into their terminal once it has been quiet for two
  seconds.
- **Plain shells** get nothing typed; check the inbox yourself.

Each PTY gets `VANDELAY_AGENT`, `VANDELAY_HIVE` and `VANDELAY_AGENT_DIR` in its environment.

### Using real agent CLIs

In a new hive, Art Vandelay runs `claude` if it is on your `PATH`; everyone else runs PowerShell (or
your `$SHELL`). To make another agent real, hire one with **+ Add agent** and the command `claude`,
or edit `.vandelay/agents.json` and change `command`, then restart the app. Sign in once inside the
agent's terminal the first time it runs.

On Windows, commands are resolved through `PATH` and `PATHEXT`, so npm shims like `claude.cmd` work
by name. If the app was itself started from inside a Claude Code session, that session's
`CLAUDE_*` variables are removed from agent terminals so each agent starts as its own session.

## Project layout

```
src/
  main/        Electron main process: window, IPC, PTYs (terminals.ts), hive and router (hive.ts)
  preload/     the typed bridge exposed as window.vandelay
  renderer/    React UI: floor canvas, terminals, composer
  shared/      types shared by all three
```

## License

MIT
