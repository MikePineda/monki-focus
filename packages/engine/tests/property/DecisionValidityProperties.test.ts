// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `validUntil` (SEMANTICS.md §5.6) against a brute-force oracle that knows
 * nothing about schedules, bedtime, midnights or DST: it evaluates the
 * decision at every whole UTC minute of the next 24 hours (wall-clock rules
 * can only change at a whole minute in every real zone) and at every instant
 * the state names, and keeps the first one at which the decision differs.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { DecisionState, Observation, Ruleset } from '@monki-focus/rules'
import { decide, epochSecondsOf, utcInstantOf } from '../../src/index.ts'
import { decisionAt, decisionInputsOf } from '../../src/DecisionEngine.ts'
import { jsonEqual } from '../../src/JsonEquality.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { decisionState, observation, ruleset } from './DecisionArbitraries.ts'

const DAY = 86_400
const QUIET = 7200

/** Days around the 2026 DST transitions of London and Sydney (UTC and Honolulu have none). */
const WEEKS = [
  '2026-03-27T00:00:00Z',
  '2026-04-03T00:00:00Z',
  '2026-10-02T00:00:00Z',
  '2026-10-23T00:00:00Z',
]
const now = fc
  .tuple(fc.constantFrom(...WEEKS), fc.integer({ min: 0, max: 3 * DAY }))
  .map(([start, offset]) => utcInstantOf(epochSecondsOf(start) + offset))

function stateInstants(state: DecisionState): number[] {
  const instants = state.unlocks.flatMap((unlock) => [unlock.notBefore, unlock.expiresAt])
  const seconds = instants.map(epochSecondsOf)
  for (const escalation of state.escalation) {
    for (const instant of [escalation.intentionExpiresAt, escalation.overrideEndsAt]) {
      if (instant !== null) seconds.push(epochSecondsOf(instant))
    }
    if (escalation.lastActivityAt !== null) {
      seconds.push(epochSecondsOf(escalation.lastActivityAt) + QUIET)
    }
  }
  return seconds
}

function oracle(rules: Ruleset, seen: Observation, state: DecisionState, at: string): string {
  const { inputs, nowSeconds } = decisionInputsOf(rules, seen, state, at, fixtureCatalog())
  const first = decisionAt(inputs, nowSeconds)
  const pending =
    state.pendingEffectiveFrom == null ? Infinity : epochSecondsOf(state.pendingEffectiveFrom)
  const horizon = Math.min(nowSeconds + DAY, pending > nowSeconds ? pending : Infinity)
  const minutes: number[] = []
  for (let t = Math.ceil((nowSeconds + 1) / 60) * 60; t <= horizon; t += 60) minutes.push(t)
  const candidates = [...minutes, ...stateInstants(state)]
    .filter((t) => t > nowSeconds && t <= horizon)
    .sort((a, b) => a - b)
  const change = candidates.find((t) => !jsonEqual(decisionAt(inputs, t), first))
  return utcInstantOf(change ?? horizon)
}

const pendingChange = fc.option(fc.integer({ min: -3600, max: 2 * DAY }), { nil: null })

describe('validUntil properties', () => {
  it('valid_until_is_the_first_instant_the_decision_changes', () => {
    fc.assert(
      fc.property(
        ruleset,
        observation,
        decisionState,
        now,
        pendingChange,
        (rules, seen, baseState, at, pendingIn) => {
          const state: DecisionState = {
            ...baseState,
            pendingEffectiveFrom:
              pendingIn === null ? null : utcInstantOf(epochSecondsOf(at) + pendingIn),
          }
          const decision = decide(rules, seen, state, at, fixtureCatalog())
          expect(decision.validUntil).toBe(oracle(rules, seen, state, at))
        }
      ),
      { numRuns: 60 }
    )
  })

  it('the_decision_holds_until_valid_until', () => {
    fc.assert(
      fc.property(
        ruleset,
        observation,
        decisionState,
        now,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (rules, seen, state, at, fraction) => {
          const decision = decide(rules, seen, state, at, fixtureCatalog())
          const start = epochSecondsOf(at)
          const end = epochSecondsOf(decision.validUntil ?? at)
          const later = utcInstantOf(start + Math.floor((end - start - 1) * fraction))
          const actual = decide(rules, seen, state, later, fixtureCatalog())
          expect({ ...actual, validUntil: null }).toEqual({ ...decision, validUntil: null })
        }
      ),
      { numRuns: 300 }
    )
  })
})
