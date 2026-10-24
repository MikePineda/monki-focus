// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import type { DecisionFixture, Rule } from '@monki-focus/rules'
import {
  budgetedRulesFor,
  decide,
  effectiveEscalationState,
  epochSecondsOf,
  frictionCandidates,
  nextEscalation,
} from '../../src/index.ts'
import { fixtureCatalog } from './FixtureCatalog.ts'
import { describeFixtures } from './FixtureRunner.ts'

/** Phases in which `decide` shows the stored gate instead of the one a visit would produce (§7.4). */
const STORED_GATE_PHASES = new Set(['pausing', 'asking', 'timed_out', 'override_waiting'])

/**
 * The adapter contract of §7.4 and §5.2.2, checked on every decision: the
 * friction candidates name the gating winner and, combined with
 * `effectiveEscalationState`, make `nextEscalation` store exactly the gate
 * `decide` returned; a spent budget belongs to a rule the activity accrues to.
 */
function checkAdapterHelpers(fixture: DecisionFixture): void {
  const { ruleset, state, now } = fixture.given
  const observation = fixture.when.target
  const { then } = fixture
  if (then.reason === 'budget_exhausted' && then.ruleId !== null) {
    expect(budgetedRulesFor(ruleset, observation, now, fixtureCatalog())).toContain(then.ruleId)
  }
  if (then.access !== 'gate' || then.ruleId === null) return
  const ids = frictionCandidates(ruleset, observation, now, fixtureCatalog())
  expect(ids).toContain(then.ruleId)
  const byId = new Map(ruleset.rules.map((rule) => [rule.id, rule]))
  const winner = byId.get(then.ruleId) as Rule
  const own = state.escalation.find(({ targetGroup }) => targetGroup === winner.id)
  if (own !== undefined && STORED_GATE_PHASES.has(own.phase)) return
  const rules = ids.map((id) => byId.get(id) as Rule)
  const effective = effectiveEscalationState(winner, rules, state.escalation, epochSecondsOf(now))
  const visited = nextEscalation(effective, { type: 'visit' }, now, state.guardianLinked)
  expect(visited.state.gate).toEqual(then.gate)
}

function checkDecision(fixture: DecisionFixture): void {
  const { ruleset, state, now } = fixture.given
  expect(decide(ruleset, fixture.when.target, state, now, fixtureCatalog())).toEqual(fixture.then)
  checkAdapterHelpers(fixture)
}

describeFixtures('decision', checkDecision)
describeFixtures('specificity', checkDecision)
