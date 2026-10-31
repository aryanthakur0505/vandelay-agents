// Claude Code hook for Vandelay Agents. The app copies this file into the hive and points each
// claude agent at it through --settings. Plain Node, no dependencies.
//
//   node claude-mail-hook.cjs context <agentDir>   SessionStart: tell Claude who it is
//   node claude-mail-hook.cjs watch <agentDir>     SessionStart/Stop with asyncRewake: wait for
//                                                  new inbox mail, then exit 2 to wake Claude
'use strict'
const fs = require('fs')
const path = require('path')

const [mode, agentDir] = process.argv.slice(2)
const id = path.basename(agentDir)
const hiveRoot = path.resolve(agentDir, '..', '..')
const inbox = path.join(agentDir, 'inbox')
const lockFile = path.join(agentDir, '.watcher')
const notifiedFile = path.join(agentDir, '.notified')

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
    `Your hive folder is ${agentDir}. New mail in ${inbox} wakes you automatically.`,
    `Start by reading your memory at ${path.join(agentDir, 'memory.md')}.`,
    '',
    read(path.join(hiveRoot, 'PROTOCOL.md')),
    role
  ].join('\n')
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }))
  process.exit(0)
}

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
    // Announce each file once, so mail Claude leaves in the inbox can't wake it in a loop.
    const notified = new Set(read(notifiedFile).split('\n').filter((f) => files.includes(f)))
    const fresh = files.filter((f) => !notified.has(f))
    if (fresh.length === 0) return setTimeout(tick, 1000)
    fs.writeFileSync(notifiedFile, [...notified, ...fresh].join('\n'))
    process.stderr.write(
      `You have ${fresh.length} new message(s) in ${inbox}: ${fresh.join(', ')}. ` +
        'Read each one, act on it, reply through your outbox if needed, then move it to archive/.'
    )
    process.exit(2)
  }
  tick()
}

if (mode === 'context') context()
else if (mode === 'watch') watch()
else process.exit(0)
