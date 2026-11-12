# Changelog

## 0.4.0 (2026-11-12)

- An end-to-end test drives the real app in CI.
- Auto-update on Windows and Linux from GitHub Releases, with **Restart to update**.
- Installers for Intel Macs and a `.deb` for Debian and Ubuntu.
- Releases sign themselves once certificates are added (docs/SIGNING.md); release notes come from
  this changelog.
- Dependabot and CodeQL keep dependencies current and scan the code.
- First-run setup check for `claude`, `node` and `git`, with install links; also in Settings.
- Errors are logged to `vandelay.log` (Settings → Open logs folder), and a UI crash shows a recovery
  screen instead of a blank window.
- The renderer runs sandboxed, and every IPC argument is checked in the main process.
- ESLint (TypeScript and React hooks rules) runs in CI; fixed what it found.
- **Settings** panel: theme, terminal text size, sound, and team export/import as
  `vandelay-team.json`.
- **Stuck** tab: mail held by the loop guard or dead-lettered, with **Deliver** and **Discard**.
- Questions: agents mark decisions they need with `QUESTION:`; unanswered ones show as **Needs
  you** in the header, top the Tasks tab, and notify as "asks you".
- **Tasks** tab: briefs still waiting for a reply, who owes them and for how long; unit cards show
  the count.
- Links in agent terminals are clickable and open in your browser.
- Ctrl + mouse wheel over a terminal changes its text size, and the size is remembered.

## 0.3.0 (2026-11-06)

- Composer: keeps an unsent draft across restarts, can't send the same brief twice, and says why a
  brief wasn't sent.
- Mail for the agent you're looking at no longer counts as unread; badges stop at 99+.
- The boot screen and the logo tooltip show the real version from `package.json`.
- Hardening: mail is only delivered to known agents, the window can't navigate away from the app,
  and only web links open in the browser.
- Prettier formats the code, and CI checks it.
- Two more hire templates: J. Peterman (product and marketing copy) and Babu (accessibility
  testing, read-only).
- Ctrl+Shift+K jumps to the composer and Ctrl+Shift+F to the comms search.
- Hire form: shows the id the agent will get, and warns when its command isn't installed.
- Renaming an agent keeps its id and tells Art; HR can let a temp go by name as well as id.
- Hiring refuses a blank name or command.
- Up and Down in an empty composer recall your last 50 briefs.
- **Reply** on a message to you points the composer at its sender.
- The window reopens where you left it, maximized or not, unless that screen is gone.
- Loop guard: two agents trading more than 12 messages a minute get their mail held, and you get
  one notice.
- Comms log: filter by agent, search, copy replies, and export a Markdown transcript.
- The comms log keeps the last 200 messages across restarts, read back from the hive's files.
- Terminal toolbar: **Stop** and **Start** an agent without letting it go, and open its **Folder**
  or **Memory** notes.
- **To: Everyone** in the composer sends one brief to every agent.
- New hives start with the full staff of eight: Art plus Kramer, Elaine, George, Jerry, Newman,
  Puddy and Jackie Chiles, each with its template model and autonomy.
- Agents are told when their mail can't be delivered, instead of waiting for a reply forever.
- Recipients written in backticks (`` to: `kramer` ``) are routed.
- Several messages from one sender in the same millisecond no longer overwrite each other.
- A broken `agents.json` is kept as a copy and the app starts with the default team.
- The window opens in the control-room colors, and clicking a reply notification focuses it.
- Keyboard: Alt+1…9 switches agents, Ctrl+Shift+C/V copies and pastes in terminals, Esc closes
  the hire form, and focus is outlined.
- Unread mail shows in the window title; the composer names who you're briefing.
- Reduced-motion systems skip the boot sequence, scanlines and blinking cursor.

## 0.2.0 (2026-11-01)

- Specialist roles: hire from templates (George, Jerry, Newman, Puddy, Jackie Chiles, Kramer,
  Elaine) or write your own specialty. The team roster (`ROSTER.md`) tells Art who does what.
- Model and autonomy per claude agent.
- Edit and let go of agents; Art gets a notice for every change.
- Temps: Art can hire up to three agents for one job through `hr`, and let them go after.
- Control-room theme (the new default): robots, circuit traces, data packets, unit cards, a status
  bar and a boot sequence. The office theme is one click away.
- Optional sound for new messages.

## 0.1.0 (2026-11-01)

- First public release: one terminal per agent, a file-based hive with inboxes and outboxes, a
  router, a 2D office floor, and claude agents that get mail through Claude Code hooks.
- Optional git worktree per agent, desktop notifications for replies, installers for Windows,
  macOS and Linux.
