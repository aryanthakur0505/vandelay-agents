import { describe, expect, it } from 'vitest'
import { AUTONOMY, MODELS, ROLE_TEMPLATES } from '../src/shared/templates'

describe('role templates', () => {
  it('have unique names, a role, and a model and autonomy the form offers', () => {
    const names = ROLE_TEMPLATES.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of ROLE_TEMPLATES) {
      expect(t.role.length).toBeGreaterThan(20)
      expect(MODELS.map((m) => m.value)).toContain(t.model)
      expect(AUTONOMY.map((a) => a.value)).toContain(t.autonomy)
    }
  })

  it('include the default team, so new hives get their roles', () => {
    expect(ROLE_TEMPLATES.map((t) => t.name)).toEqual(expect.arrayContaining(['Kramer', 'Elaine']))
  })
})
