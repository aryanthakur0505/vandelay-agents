import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { SetupStatus } from '@shared/types'
import { findExecutable } from './terminals'

/** What a first run needs, and what's already there: the tools agents use and a git workspace. */
export function checkSetup(workspace: string): SetupStatus {
  return {
    claude: findExecutable('claude'),
    node: findExecutable('node'),
    git: findExecutable('git'),
    workspaceIsGit: existsSync(join(workspace, '.git'))
  }
}
