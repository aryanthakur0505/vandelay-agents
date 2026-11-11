// Prints the CHANGELOG.md section for a version, for the GitHub release body.
// Usage: node scripts/release-notes.mjs 0.4.0   (a leading "v" is fine)
import { readFileSync } from 'node:fs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
const lines = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l === `## ${version}`)
if (!version || start === -1) {
  console.error(`No "## ${version}" section in CHANGELOG.md`)
  process.exit(1)
}
const end = lines.findIndex((l, i) => i > start && l.startsWith('## '))
console.log(
  lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
)
