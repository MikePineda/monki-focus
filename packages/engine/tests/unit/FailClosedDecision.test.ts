// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Observation } from '@monki-focus/rules'
import { ENGINE_ERROR_DECISION, decide } from '../../src/index.ts'
import { decideOrThrow } from '../../src/DecisionEngine.ts'
import { epochSecondsOf } from '../../src/Instant.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { makeEscalation, makeRule, makeRuleset, makeState } from '../factories/RulesetFactory.ts'

const NOW = '2026-10-26T10:00:00Z'
const FAIL_CLOSED = {
  access: 'block',
  content: 'hide-feed',
  ruleId: null,
  reason: 'engine_error',
  explanationKey: 'decision.engine_error',
}
const page: Observation = { kind: 'site', urlText: 'https://news.example.org/today' }

describe('FailClosedDecision', () => {
  it('garbage_url_text_fails_closed', () => {
    for (const urlText of [null, undefined, 42, { href: 'x' }]) {
      const garbage = { kind: 'site', urlText } as unknown as Observation
      expect(decide(makeRuleset(), garbage, makeState(), NOW, fixtureCatalog())).toEqual(
        FAIL_CLOSED
      )
    }
    expect(
      decide(makeRuleset(), null as unknown as Observation, makeState(), NOW, fixtureCatalog())
    ).toEqual(FAIL_CLOSED)
  })

  it('instant_without_offset_fails_closed', () => {
    expect(
      decide(makeRuleset(), page, makeState(), '2026-10-26T10:00:00', fixtureCatalog())
    ).toEqual(FAIL_CLOSED)
    const unlock = {
      target: { kind: 'site', domain: 'news.example.org' },
      notBefore: '2026-10-26 09:00',
      expiresAt: NOW,
    } as const
    const ruleset = makeRuleset({
      rules: [makeRule({ id: 'r', target: { kind: 'site', domain: 'news.example.org' } })],
    })
    expect(decide(ruleset, page, makeState({ unlocks: [unlock] }), NOW, fixtureCatalog())).toEqual(
      FAIL_CLOSED
    )
  })

  it('invalid_state_instants_fail_closed_even_when_no_rule_reads_them', () => {
    const unlock = {
      target: { kind: 'site', domain: 'news.example.org' },
      notBefore: NOW,
      expiresAt: 'later',
    } as const
    expect(
      decide(makeRuleset(), page, makeState({ unlocks: [unlock] }), NOW, fixtureCatalog())
    ).toEqual(FAIL_CLOSED)
    const escalation = [makeEscalation('r-x', { lastActivityAt: '2026-10-26T09:00:00' })]
    expect(decide(makeRuleset(), page, makeState({ escalation }), NOW, fixtureCatalog())).toEqual(
      FAIL_CLOSED
    )
  })

  it('an_unknown_observation_kind_fails_closed', () => {
    const unknown = { kind: 'file', path: '/tmp/x' } as unknown as Observation
    expect(decide(makeRuleset(), unknown, makeState(), NOW, fixtureCatalog())).toEqual(FAIL_CLOSED)
  })

  it('unknown_time_zone_fails_closed', () => {
    expect(
      decide(makeRuleset({ timeZone: 'Mars/Olympus' }), page, makeState(), NOW, fixtureCatalog())
    ).toEqual(FAIL_CLOSED)
    const pending = makeRuleset({ pendingTimeZone: 'Mars/Olympus' })
    expect(decide(pending, page, makeState(), NOW, fixtureCatalog())).toEqual(FAIL_CLOSED)
  })

  it('the_fail_closed_decision_has_no_gate_and_is_a_fresh_object', () => {
    const decision = decide(
      makeRuleset({ timeZone: 'Mars/Olympus' }),
      page,
      makeState(),
      NOW,
      fixtureCatalog()
    )
    expect(decision).not.toHaveProperty('gate')
    expect(decision).not.toBe(ENGINE_ERROR_DECISION)
  })

  it('the_core_throws_so_tests_see_the_error', () => {
    expect(() =>
      decideOrThrow(makeRuleset(), page, makeState(), '2026-10-26T10:00:00', fixtureCatalog())
    ).toThrow(RangeError)
  })

  it('valid_input_decides_normally', () => {
    expect(decide(makeRuleset(), page, makeState(), NOW, fixtureCatalog())).toMatchObject({
      access: 'allow',
      reason: 'no_rule',
    })
  })
})

describe('Instant strict parsing', () => {
  it.each([
    '2026-10-26T10:00:00',
    '2026-10-26 10:00:00Z',
    '2026-10-26T10:00:00.5Z',
    '2026-10-26T10:00Z',
    '2026-10-26T10:00:00z',
    '2026-10-26T10:00:00+1100',
    '2026-13-01T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-10-26T24:00:00Z',
    '2026-10-26T10:60:00Z',
    '2026-10-26T10:00:60Z',
    '2026-10-26T10:00:00+24:00',
    '2026-10-26T10:00:00+10:60',
    'Mon, 26 Oct 2026 10:00:00 GMT',
  ])('rejects_%s', (text) => {
    expect(() => epochSecondsOf(text)).toThrow(RangeError)
  })

  it('rejects_a_value_that_is_not_text', () => {
    expect(() => epochSecondsOf(1_793_000_000 as unknown as string)).toThrow(RangeError)
  })

  it('applies_explicit_offsets_both_ways', () => {
    expect(epochSecondsOf('2026-10-26T10:00:00+11:00')).toBe(epochSecondsOf('2026-10-25T23:00:00Z'))
    expect(epochSecondsOf('2026-10-25T13:00:00-10:00')).toBe(epochSecondsOf('2026-10-25T23:00:00Z'))
    expect(epochSecondsOf('2028-02-29T00:00:00Z')).toBe(Date.UTC(2028, 1, 29) / 1000)
  })
})
