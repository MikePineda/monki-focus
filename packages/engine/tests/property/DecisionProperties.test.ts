// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { decide } from '../../src/index.ts'
import { fixtureCatalog } from '../fixtures/FixtureCatalog.ts'
import { decisionState, now, observation, ruleset } from './DecisionArbitraries.ts'

const RUNS = { numRuns: 400 }

describe('decide properties', () => {
  it('same_inputs_same_decision', () => {
    fc.assert(
      fc.property(ruleset, observation, decisionState, now, (rules, seen, state, at) => {
        const copy = structuredClone({ rules, seen, state, at })
        const first = decide(rules, seen, state, at, fixtureCatalog())
        const second = decide(copy.rules, copy.seen, copy.state, copy.at, fixtureCatalog())
        expect(second).toEqual(first)
        // Pure: the inputs are left untouched.
        expect({ rules, seen, state, at }).toEqual(copy)
      }),
      RUNS
    )
  })

  it('decision_is_independent_of_rule_order', () => {
    const shuffled = ruleset.chain((rules) =>
      fc
        .shuffledSubarray(rules.rules, {
          minLength: rules.rules.length,
          maxLength: rules.rules.length,
        })
        .map((order) => ({ original: rules, reordered: { ...rules, rules: order } }))
    )
    fc.assert(
      fc.property(
        shuffled,
        observation,
        decisionState,
        now,
        ({ original, reordered }, seen, state, at) => {
          expect(decide(reordered, seen, state, at, fixtureCatalog())).toEqual(
            decide(original, seen, state, at, fixtureCatalog())
          )
        }
      ),
      RUNS
    )
  })
})
