import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile('git', args, { cwd, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout.trim())
    )
  )
}

/**
 * Gives an agent its own git worktree of the workspace, on branch `vandelay/<id>`, so agents that
 * edit code at the same time can't overwrite each other. Reuses the worktree and branch if they
 * already exist. Throws when the workspace is not a git repository.
 */
export async function ensureWorktree(repo: string, dir: string, id: string): Promise<string> {
  const branch = `vandelay/${id}`
  if (existsSync(join(dir, '.git'))) return branch
  const exists = await git(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).then(
    () => true,
    () => false
  )
  await git(repo, exists ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir])
  return branch
}
