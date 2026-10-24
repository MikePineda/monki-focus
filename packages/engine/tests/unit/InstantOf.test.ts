// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { decide, instantOf } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeRuleset, makeState } from '../factories/RulesetFactory.ts'

describe('instantOf', () => {
  it('instant_of_floors_milliseconds', () => {
    expect(instantOf(Date.UTC(2026, 9, 26, 10, 0, 0, 999))).toBe('2026-10-26T10:00:00Z')
    expect(instantOf(0)).toBe('1970-01-01T00:00:00Z')
  })

  it('instant_of_output_is_accepted_by_decide', () => {
    const now = instantOf(Date.UTC(2026, 9, 26, 10, 0, 0, 123))
    const decision = decide(
      makeRuleset(),
      { kind: 'site', urlText: 'https://news.example.org/today' },
      makeState(),
      now,
      fixtureCatalog()
    )
    expect(decision.reason).toBe('no_rule')
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'instant_of_rejects_%s_as_an_adapter_bug',
    (epochMillis) => {
      expect(() => instantOf(epochMillis)).toThrow(RangeError)
    }
  )
})
