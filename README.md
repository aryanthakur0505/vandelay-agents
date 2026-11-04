# Vandelay Agents

**Importer and exporter of work.** Vandelay Agents is a desktop app that runs the terminal coding
CLIs you already use (`claude`, `codex`, `gemini`, or any shell command) as a team of agents. Each
agent gets a real terminal, an inbox, an outbox and a memory file, and sits at a desk on a 2D office
floor. Art Vandelay, the orchestrator, takes your brief and routes the work to everyone else.

> A Seinfeld parody. Not affiliated with Seinfeld, NBC or Castle Rock. All code and art here are
> original.

*Electron · React · TypeScript · electron-vite · xterm.js · node-pty*

## Why

One Claude Code session does one thing at a time, and you drive every step. Vandelay Agents puts
a manager and a team on top of the same CLI:

- **Brief once.** Tell Art what you want; Art splits it up, hands each piece to the agent whose
  specialty fits, and reports back.
- **Work in parallel.** Code, tests, docs and review can run at the same time in separate agents.
- **Focused specialists.** A reviewer only reviews, an auditor only audits, each with its own memory.
- **No collisions.** With worktrees, each agent edits on its own branch; you merge what you like.
- **Watch or walk away.** See who's busy on the floor, open any terminal, or wait for the
  desktop notification when Art replies.

It pays off on jobs that split into independent parts. For a quick one-step change a single
session is faster and cheaper: every claude agent uses your account's tokens.

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
- [x] Specialist roles with templates, a team roster the orchestrator routes by, model and autonomy
      per agent, edit and let go, temps the orchestrator hires for one job.
- [x] A control-room theme: robots, circuit traces, data packets, unit cards, status bar, boot
      sequence (the original office theme is one click away).

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

- Node.js 20.19+ or 22.12+ (what Vite 8 needs), and npm. `.nvmrc` pins 22.
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
| `npm test` | unit tests (vitest): router, team and temps, mail hook, claude settings, worktrees |
| `npm run test:watch` | the same tests, rerun on every save |
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
  agents.json          the roster (the app's copy)
  ROSTER.md            the team as agents read it: ids, names, specialties
  PROTOCOL.md          how agents message each other
  you/                 replies addressed to you
  dead-letter/         messages with an unknown recipient
  former/              folders of agents you let go
  agents/<id>/
    inbox/  outbox/  archive/  memory.md  ROLE.md
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

### The team

A new hive starts with three agents, all running `claude` if it is on your `PATH` (PowerShell or
your `$SHELL` otherwise):

| Agent | Job |
| --- | --- |
| **Art Vandelay** | Orchestrator. The one you brief. Splits the work, sends each piece to the right agent, reports back to you. |
| **Kramer** | Fast prototyper: tries ideas quickly and reports what worked. |
| **Elaine** | Writer: READMEs, docs, changelogs, release notes. |

**Hire more** with **+ Hire**. Start from a role template (George the reviewer, Jerry the front-end
engineer, Newman the security auditor, Puddy for DevOps, Jackie Chiles for licences, and the two
above) or write your own specialty. For claude agents you can also choose:

- **Model**: your default, Opus, Sonnet or Haiku. Cheaper models suit simple roles.
- **Autonomy**: your Claude Code default, read-only (`plan`), ask before every action, edit files
  freely (`acceptEdits`), or `auto`.

Each agent's specialty goes into its `ROLE.md` and into `.vandelay/ROSTER.md`, which every agent
reads at start-up, so Art knows who is good at what. Whenever you hire, edit or let go of an agent,
Art gets a notice from `vandelay` (the app) and doesn't reply to it. **Edit** changes an agent
(applies on the next **Restart**); **Let go** stops it and moves its folder to `.vandelay/former/`.
Art can't be let go. Past about eight agents the form warns you: each claude agent uses your
account's tokens, and more agents mostly add cost, not speed.

**Temps.** For a one-off job Art can hire a temp by writing to `hr`:

```
to: hr
---
hire: Bania
role: Tells one clean joke.
model: haiku
```

HR (the app) replies with the temp's id, the temp appears on the floor, and Art lets it go with
`fire: <id>` when the job is done. Only the orchestrator can hire temps, at most three at once.

The protocol tells agents not to answer replies or acknowledgements, so two agents can't thank each
other forever. Replies addressed to you show in full in the comms log, with a desktop notification
when the window isn't focused. Sign in once inside an agent's terminal the first time it runs.

### Themes

**Control room** (the default) is the Robotics Division: robots at workstations on a glowing grid,
data packets running along circuit traces, unit cards, a status bar with units online, packets
routed, uptime and a clock, and a boot sequence (click or press a key to skip). **Office theme** is
the original warm office with desks and envelopes. Toggle in the header; **Sound** adds a short
blip for each message (off by default). Both settings are remembered.

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

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Agents show a PowerShell or bash prompt instead of Claude | `claude` wasn't on `PATH` when the hive was created. Install Claude Code, then **Edit** each agent and set the command to `claude`. |
| A claude agent never reacts to mail | Check that `node` is on `PATH` (the mail hook runs on it). Without Node the app types a prompt instead, which only lands when the terminal is idle. |
| An agent asks you to sign in | Sign in once inside its terminal; later agents reuse the login. |
| Mail ends up in `.vandelay/dead-letter/` | The `to:` id didn't match anyone on `.vandelay/ROSTER.md`. The sender gets a notice saying so. |
| "No worktree" in an agent's terminal | The workspace isn't a git repository, so the agent works in the workspace itself. |
| The team is gone after editing `agents.json` by hand | The file had a JSON error. Your version is kept as `agents.json.broken-<time>` next to it. |

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

To publish a release, bump `version` in `package.json`, move the "Unreleased" notes in
`CHANGELOG.md` under the new version, commit, then tag and push:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

The Release workflow builds the installers on all three systems and attaches them to a GitHub
release for that tag.

## License

MIT
