// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  loadDefaultCategories,
  loadFixtures,
  loadStarterPreset,
  loadSurfaceRegistry,
  schemaValidator,
} from '../../src/index.ts'

describe('duplicate keys are invalid data', () => {
  it('duplicate_rule_ids_are_rejected', () => {
    const preset = loadStarterPreset()
    const [first] = preset.rules
    const result = schemaValidator().validate('ruleset', {
      ...preset,
      rules: first ? [first, { ...first, mode: 'block' }] : [],
    })
    expect(result.valid).toBe(false)
  })

  it('duplicate_category_targets_in_a_rule_set_are_rejected', () => {
    const preset = loadStarterPreset()
    const assignment = { target: { kind: 'site', domain: 'news.example.org' }, category: 'news' }
    const result = schemaValidator().validate('ruleset', {
      ...preset,
      categories: [
        { ...assignment, level: 25 },
        { ...assignment, level: 75 },
      ],
    })
    expect(result.valid).toBe(false)
  })

  it('duplicate_default_category_targets_are_rejected', () => {
    const catalog = loadDefaultCategories()
    const [first] = catalog.assignments
    const result = schemaValidator().validate('category-catalog', {
      ...catalog,
      assignments: [...catalog.assignments, { ...first, level: 75 }],
    })
    expect(result.valid).toBe(false)
  })

  it('duplicate_surface_ids_are_rejected', () => {
    const registry = loadSurfaceRegistry()
    const [first] = registry.surfaces
    const result = schemaValidator().validate('surface-registry', {
      ...registry,
      surfaces: [...registry.surfaces, { ...first, kind: 'utility' }],
    })
    expect(result.valid).toBe(false)
  })

  it('duplicate_escalation_groups_in_a_decision_state_are_rejected', () => {
    const fixture = structuredClone(
      loadFixtures('decision').find((f) => f.given.state.escalation.length > 0)
    )
    const state = fixture?.given.state.escalation[0]
    if (fixture && state) fixture.given.state.escalation.push({ ...state, attemptCount: 9 })
    expect(schemaValidator().validate('fixture', fixture).valid).toBe(false)
  })
})
