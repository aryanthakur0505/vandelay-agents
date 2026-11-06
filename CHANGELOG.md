# Changelog

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
