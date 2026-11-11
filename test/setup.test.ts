import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { checkSetup } from '../src/main/setup'
import { scratch } from './helpers'

describe('checkSetup', () => {
  it('finds node, and tells a git workspace from a plain folder', () => {
    const plain = scratch()
    const repo = scratch()
    execFileSync('git', ['init', '-q'], { cwd: repo })
    expect(checkSetup(plain)).toMatchObject({ workspaceIsGit: false })
    const status = checkSetup(repo)
    expect(status.workspaceIsGit).toBe(true)
    expect(status.node).toBeTruthy()
    expect(status.git).toBeTruthy()
  })
})
