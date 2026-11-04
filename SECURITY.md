# Security

Vandelay Agents runs agent CLIs (`claude`, `codex`, shells) with your account, your permissions and
your files, in the folder you choose. Treat it like any tool that can run commands for you:

- Point it at a project you're happy for agents to edit, not your home folder.
- Claude agents follow your Claude Code permission settings unless you give them more autonomy in
  the hire form. Read-only (`plan`) is the safest choice for reviewers and auditors.
- Messages between agents are plain files in `.vandelay/`. Anything that can write there can send
  an agent instructions.

## Reporting a vulnerability

Please report security problems privately through
[GitHub's private vulnerability reporting](https://github.com/aryanthakur0505/vandelay-agents/security/advisories/new)
rather than in a public issue. Include what you found, how to reproduce it and which version you
ran.
