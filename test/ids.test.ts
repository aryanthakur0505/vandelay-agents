import { describe, expect, it } from 'vitest'
import { nextId, slug } from '../src/shared/ids'

describe('slug', () => {
  it('lowercases and hyphenates names', () => {
    expect(slug('Jackie Chiles')).toBe('jackie-chiles')
    expect(slug('  J. Peterman!! ')).toBe('j-peterman')
  })

  it('falls back to "agent" for names with no letters or digits', () => {
    expect(slug('***')).toBe('agent')
  })
})

describe('nextId', () => {
  it('numbers duplicates and skips reserved addresses', () => {
    const taken = new Set(['kramer', 'kramer-2'])
    expect(nextId('Kramer', (id) => taken.has(id))).toBe('kramer-3')
    expect(nextId('You', () => false)).toBe('you-2')
    expect(nextId('HR', () => false)).toBe('hr-2')
    expect(nextId('Elaine', () => false)).toBe('elaine')
  })
})
