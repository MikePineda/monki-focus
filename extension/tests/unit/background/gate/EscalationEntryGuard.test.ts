// SPDX-License-Identifier: AGPL-3.0-or-later
import { initialEscalationState } from '@monki-focus/engine'
import { loadFixtures } from '@monki-focus/rules'
import { describe, expect, it } from 'vitest'
import {
  escalationEntryGuard,
  hasEscalationShape,
} from '../../../../src/background/gate/EscalationEntryGuard'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { gatedRuleset } from '../../../support/gateHarness'

const NOW = Date.parse('2026-01-05T09:00:00Z')

/** Every state the shared escalation fixtures start from or reach. */
function fixtureStates(): unknown[] {
  return loadFixtures('escalation').flatMap((fixture) => {
    const { given, steps } = fixture as unknown as {
      given: { state: unknown }
      steps: { then: { state: unknown } }[]
    }
    return [given.state, ...steps.map((step) => step.then.state)]
  })
}

function guard() {
  const ruleset = gatedRuleset()
  return escalationEntryGuard(
    bundledRulesCatalog(),
    { load: () => Promise.resolve(ruleset) },
    () => NOW
  )
}

describe('EscalationEntryGuard', () => {
  it('the_precompiled_schema_accepts_every_state_of_the_shared_fixtures', () => {
    const states = fixtureStates()

    expect(states.length).toBeGreaterThan(10)
    for (const state of states) expect(hasEscalationShape(state)).toBe(true)
  })

  it('the_precompiled_schema_drops_entries_outside_the_escalation_state_schema', () => {
    const valid = initialEscalationState('starter-reddit-friction')
    const invalid: unknown[] = [
      { ...valid, extra: true },
      { ...valid, targetGroup: '__proto__' },
      { ...valid, phase: 'gone' },
      { ...valid, attemptCount: 1001 },
      { ...valid, brokenCount: -1 },
      { ...valid, lastActivityAt: '2026-01-05T09:00:00+10:00' },
      { ...valid, pauseEndsAt: '2026-02-30T09:00:00Z' },
      { ...valid, gate: { level: 1, pauseSeconds: 15, frictionType: 'countdown' } },
      { ...valid, lastFrictionType: 'scroll' },
      [valid],
      null,
    ]

    expect(hasEscalationShape(valid)).toBe(true)
    for (const entry of invalid) expect(hasEscalationShape(entry)).toBe(false)
  })

  it('an_instant_the_schema_admits_but_the_engine_refuses_is_dropped', async () => {
    const leapSecond = {
      ...initialEscalationState('starter-reddit-friction'),
      lastActivityAt: '2026-12-31T23:59:60Z',
    }

    expect(await guard()(initialEscalationState('starter-reddit-friction'))).toBe(true)
    expect(hasEscalationShape(leapSecond)).toBe(true)
    expect(await guard()(leapSecond)).toBe(false)
  })
})
