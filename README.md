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
- [x] `claude` agents get mail through Claude Code hooks; a full round trip (you → Art → workers →
      Art → you) runs with nothing typed into a terminal.
- [x] Optional git worktree per agent, desktop notifications for replies, an installer.

Later: voice, Slack, approvals, budgets, semantic memory, walking avatars.

## Install

Download the installer for your system from the [latest release](../../releases/latest):

| System | File | First launch |
| --- | --- | --- |
| Windows 10/11 (x64) | `vandelay-agents-x.y.z-win-x64.exe` | The installer isn't code-signed, so SmartScreen warns: click **More info → Run anyway**. |
| macOS (Apple silicon) | `vandelay-agents-x.y.z-mac-arm64.dmg` | Not notarized: drag the app to Applications, then run `xattr -cr "/Applications/Vandelay Agents.app"` once. |
| Linux (x64) | `vandelay-agents-x.y.z-linux-*.AppImage` | `chmod +x` the file, then run it. |

On first launch the app asks which folder your agents should work in (usually a project folder).

To get real agents rather than plain shells, you also need:

- [Claude Code](https://docs.claude.com/en/docs/claude-code) (`claude`) on your `PATH`, signed in
  once in a normal terminal. Other agent CLIs (`codex`, `gemini`, …) work too, with typed prompts
  instead of hooks.
- [Node.js](https://nodejs.org) on your `PATH`. Claude agents' mail hook runs on it.

Agents act with your Claude account and your Claude Code permission settings, in the folder you
choose. Point it at a project you're happy for them to edit.

## Build from source

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
npm run dev     # opens the app; the UI hot-reloads
```

| Script | What it does |
| --- | --- |
| `npm run dev:watch` | like `dev`, but also restarts the app when `src/main` or `src/preload` change (this restarts your agents) |
| `npm test` | unit tests (vitest): router, mail hook, claude settings, worktrees |
| `npm run typecheck` | TypeScript checks for all three processes |
| `npm run build` / `npm run preview` | production build, and running it |
| `npm run dist` | an installer in `release/` (NSIS on Windows, dmg on macOS, AppImage on Linux) |
| `npm run dist:dir` | the unpacked app only, quicker to test |

`npm run dev` works in the folder it was started from. The installed app asks for a folder the first
time and remembers it; click **change** next to the path in the header to switch (the app restarts).
`VANDELAY_WORKSPACE` overrides both.

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
  armed at session start and after every turn, waits for new inbox files, moves them to `archive/`
  and exits with code 2 with the message text, which wakes Claude even when it is idle. Nothing is
  typed into the terminal, so dialogs and permission prompts are never answered by accident. The
  settings also let the agent write in its own folder (outbox, memory) without a permission prompt;
  anything else follows your normal Claude Code permission mode. The hook script runs on `node`;
  without Node on `PATH`, claude agents fall back to typed prompts. If mail is still in the inbox
  five seconds after it arrives, the watcher has died (it times out after a day), so the app types
  the prompt instead. When a claude agent starts, any session left over from a force-killed app
  (found by its settings file) is stopped first.
- **Other agent CLIs** get a short prompt typed into their terminal once it has been quiet for two
  seconds.
- **Plain shells** get nothing typed; check the inbox yourself.

Each PTY gets `VANDELAY_AGENT`, `VANDELAY_HIVE` and `VANDELAY_AGENT_DIR` in its environment.

### Using real agent CLIs

In a new hive, Art Vandelay, Kramer and Elaine all run `claude` if it is on your `PATH`, and
PowerShell (or your `$SHELL`) otherwise. An existing hive keeps its roster: hire more agents with
**+ Add agent** and the command `claude`, or edit `command` in `.vandelay/agents.json` and restart
the app. Sign in once inside an agent's terminal the first time it runs.

Workers get a short `ROLE.md`: do the task, reply to the sender, ask when blocked. The protocol tells
agents not to answer replies or acknowledgements, so two agents can't thank each other forever.
Replies addressed to you show in full in the message log, with a desktop notification when the
window isn't focused.

### Git worktrees

Agents that edit code in the same folder can overwrite each other. Tick **Own git worktree** when
hiring (or set `"worktree": true` in `agents.json`) and the agent works in
`.vandelay/worktrees/<id>` on branch `vandelay/<id>`, created from the workspace's current commit
and reused after that. Its role tells it to commit there; merging the branch is up to you. The
workspace has to be a git repository, otherwise the agent works in the workspace and says why. The
hive writes its own `.gitignore`, so it never shows up in `git status`.

On Windows, commands are resolved through `PATH` and `PATHEXT`, so npm shims like `claude.cmd` work
by name. If the app was itself started from inside a Claude Code session, that session's
`CLAUDE_*` variables are removed from agent terminals so each agent starts as its own session.

## Project layout

```
src/
  main/        Electron main process: window, IPC, PTYs (terminals.ts), hive and router (hive.ts),
               claude hooks (claudeHooks.ts, hooks/), worktrees.ts, workspace.ts
  preload/     the typed bridge exposed as window.vandelay
  renderer/    React UI: floor canvas, terminals, composer
  shared/      types shared by all three
test/          vitest unit tests
```

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `npm run typecheck` and `npm test`;
CI runs both, plus a build, on Windows, macOS and Linux. Keep code and art original: no assets or
code copied from other projects.

To publish a release, bump `version` in `package.json`, commit, then tag and push:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The Release workflow builds the installers on all three systems and attaches them to a GitHub
release for that tag.

## License

MIT
