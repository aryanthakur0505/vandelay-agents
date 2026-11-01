// Claude Code hook for Vandelay Agents. The app copies this file into the hive and points each
// claude agent at it through --settings. Plain Node, no dependencies.
//
//   node claude-mail-hook.cjs context <agentDir>   SessionStart: tell Claude who it is
//   node claude-mail-hook.cjs watch <agentDir>     SessionStart/Stop with asyncRewake: wait for
//                                                  new inbox mail, archive it, then exit 2
//                                                  with the mail in stderr to wake Claude
'use strict'
const fs = require('fs')
const path = require('path')

const [mode, agentDir] = process.argv.slice(2)
const id = path.basename(agentDir)
const hiveRoot = path.resolve(agentDir, '..', '..')
const inbox = path.join(agentDir, 'inbox')
const lockFile = path.join(agentDir, '.watcher')
const archive = path.join(agentDir, 'archive')

// Claude Code writes the hook input to stdin; we don't need it, but drain it so the pipe closes.
process.stdin.on('error', () => {})
process.stdin.resume()

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function agentName() {
  try {
    const agents = JSON.parse(read(path.join(hiveRoot, 'agents.json')))
    return (agents.find((a) => a.id === id) || {}).name || id
  } catch {
    return id
  }
}

function context() {
  const role = read(path.join(agentDir, 'ROLE.md'))
  const text = [
    `You are ${agentName()} (agent id "${id}") in Vandelay Agents, a team of terminal agents.`,
    `Your hive folder is ${agentDir}. New mail wakes you automatically, with the message text included and the file already moved from inbox/ to archive/, so you never need to move mail yourself.`,
    `Start by reading your memory at ${path.join(agentDir, 'memory.md')}.`,
    '',
    read(path.join(hiveRoot, 'PROTOCOL.md')),
    read(path.join(hiveRoot, 'ROSTER.md')),
    role
  ].join('\n')
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
  process.exit(0)
}

// Long messages are cut short in the wake-up note; the full text stays in archive/.
const MAX_BODY = 8000

function watch() {
  // The newest watcher owns the lock; older ones (from earlier turns) see that and bow out.
  const token = `${process.pid}-${Date.now()}`
  fs.writeFileSync(lockFile, token)
  const tick = () => {
    if (read(lockFile) !== token) process.exit(0)
    let files
    try {
      files = fs.readdirSync(inbox).filter((f) => f.endsWith('.md')).sort()
    } catch {
      files = []
    }
    // Hand Claude the mail itself and file it in archive/, so the agent needs no shell commands to
    // read or move it, and the same mail can never wake it twice.
    const letters = []
    for (const f of files) {
      const text = read(path.join(inbox, f))
      const dest = path.join(archive, f)
      try {
        fs.renameSync(path.join(inbox, f), dest)
      } catch {
        continue // still being written, or locked; try again next tick
      }
      const body = text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}\n[... cut short, full text in ${dest}]` : text
      letters.push(`=== ${f} (now in ${dest}) ===\n${body.trim()}`)
    }
    if (letters.length === 0) return setTimeout(tick, 1000)
    process.stderr.write(
      `You have ${letters.length} new message(s). They are already filed in ${archive}. ` +
        'Act on each one and reply through your outbox if needed.\n\n' +
        letters.join('\n\n')
    )
    process.exit(2)
  }
  tick()
}

if (mode === 'context') context()
else if (mode === 'watch') watch()
else process.exit(0)
