# Changelog

## Unreleased

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
