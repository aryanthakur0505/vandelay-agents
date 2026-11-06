# Security

Vandelay Agents runs agent CLIs (`claude`, `codex`, shells) with your account, your permissions and
your files, in the folder you choose. Treat it like any tool that can run commands for you:

- Point it at a project you're happy for agents to edit, not your home folder.
- Claude agents follow your Claude Code permission settings unless you give them more autonomy in
  the hire form. Read-only (`plan`) is the safest choice for reviewers and auditors.
- Messages between agents are plain files in `.vandelay/`. Anything that can write there can send
  an agent instructions.

## What the app does to limit damage

- The router only delivers to agents on the roster, so a message can't be written outside the hive.
- Two agents stuck replying to each other have their mail held after 12 messages in a minute.
- The app window can't be navigated away from the app, and only `http(s)` links open in your browser.
- The renderer can only open an agent's own folder, `memory.md` or `ROLE.md`, never an arbitrary path.

## Reporting a vulnerability

Please report security problems privately through
[GitHub's private vulnerability reporting](https://github.com/aryanthakur0505/vandelay-agents/security/advisories/new)
rather than in a public issue. Include what you found, how to reproduce it and which version you
ran.
