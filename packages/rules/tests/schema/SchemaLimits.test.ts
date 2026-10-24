// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loadFixtures, loadStarterPreset, schemaValidator } from '../../src/index.ts'

const preset = loadStarterPreset()

function isValidRuleset(value: unknown): boolean {
  return schemaValidator().validate('ruleset', value).valid
}

function escalationFixture() {
  const fixture = structuredClone(loadFixtures('escalation')[0])
  if (!fixture) throw new Error('missing escalation fixture')
  return fixture
}

describe('schema limits', () => {
  it('rule_set_pins_its_time_zone', () => {
    const withoutZone: Record<string, unknown> = { ...preset }
    delete withoutZone.timeZone
    expect(isValidRuleset(withoutZone)).toBe(false)
    expect(isValidRuleset({ ...preset, timeZone: 'Australia/Sydney' })).toBe(true)
  })

  it('pending_time_zone_is_optional', () => {
    expect(isValidRuleset({ ...preset, pendingTimeZone: 'Europe/London' })).toBe(true)
  })

  it('revision_fits_a_signed_32_bit_integer', () => {
    expect(isValidRuleset({ ...preset, revision: 2 ** 31 - 1 })).toBe(true)
    expect(isValidRuleset({ ...preset, revision: 2 ** 31 })).toBe(false)
  })

  it('hide_feed_rules_take_no_budget', () => {
    const rule = preset.rules.find((candidate) => candidate.mode === 'hide-feed')
    expect(isValidRuleset({ ...preset, rules: [{ ...rule, dailyBudgetMinutes: 30 }] })).toBe(false)
  })

  it('typed_words_are_capped_at_50', () => {
    const fixture = escalationFixture()
    const step = fixture.steps[0]
    if (step)
      step.event = { type: 'commit', minutes: 5, typedWords: 51, guardianKeyVerified: false }
    expect(schemaValidator().validate('fixture', fixture).valid).toBe(false)
  })

  it('escalation_counters_are_bounded', () => {
    const tooManyAttempts = escalationFixture()
    tooManyAttempts.given.state.attemptCount = 1001
    expect(schemaValidator().validate('fixture', tooManyAttempts).valid).toBe(false)
    const tooManyBroken = escalationFixture()
    tooManyBroken.given.state.brokenCount = 17
    expect(schemaValidator().validate('fixture', tooManyBroken).valid).toBe(false)
  })

  it('activity_path_is_capped_at_2048_characters', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find((f) => f.operation === 'categorise')
    )
    if (fixture?.operation === 'categorise') {
      fixture.given.activity.path = `/${'a'.repeat(2048)}`
    }
    expect(schemaValidator().validate('fixture', fixture).valid).toBe(false)
  })
})
