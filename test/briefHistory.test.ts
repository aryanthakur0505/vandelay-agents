import { describe, expect, it } from 'vitest'
import { remember, step } from '../src/renderer/src/briefHistory'

describe('remember', () => {
  it('puts the newest brief first and drops duplicates and blanks', () => {
    let h: string[] = []
    h = remember(h, 'one')
    h = remember(h, ' two ')
    h = remember(h, 'one')
    h = remember(h, '   ')
    expect(h).toEqual(['one', 'two'])
  })

  it('keeps at most the cap', () => {
    let h: string[] = []
    for (let i = 0; i < 5; i++) h = remember(h, `b${i}`, 3)
    expect(h).toEqual(['b4', 'b3', 'b2'])
  })
})

describe('step', () => {
  const h = ['newest', 'middle', 'oldest']

  it('walks older until the oldest, then stays', () => {
    expect([step(h, -1, 'older'), step(h, 0, 'older'), step(h, 2, 'older')]).toEqual([0, 1, 2])
  })

  it('walks newer back to not browsing', () => {
    expect([step(h, 2, 'newer'), step(h, 0, 'newer'), step(h, -1, 'newer')]).toEqual([1, -1, -1])
  })

  it('has nowhere to go in an empty history', () => {
    expect(step([], -1, 'older')).toBe(-1)
  })
})
