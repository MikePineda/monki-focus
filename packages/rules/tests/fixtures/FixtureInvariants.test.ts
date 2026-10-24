// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { checkFixtureInvariants, loadFixtures } from '../../src/index.ts'
import type { DecisionFixture, EscalationFixture } from '../../src/index.ts'

function firstDecision(predicate: (fixture: DecisionFixture) => boolean): DecisionFixture {
  const found = [...loadFixtures('decision'), ...loadFixtures('specificity')].find(predicate)
  if (!found) throw new Error('no fixture matches the predicate')
  return structuredClone(found)
}

function firstEscalation(): EscalationFixture {
  const found = loadFixtures('escalation').find(
    (fixture) => fixture.id === 'escalation.escalation_goes_5s_15s_typed_guardian'
  )
  if (!found) throw new Error('missing escalation fixture')
  return structuredClone(found)
}

describe('reference invariants', () => {
  it('explanation_key_must_match_the_primary_outcome', () => {
    const fixture = firstDecision(
      (f) => f.then.reason === 'rule_match' && f.then.access === 'block'
    )
    fixture.then.explanationKey = 'decision.allowed_by_rule'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/explanationKey/)
  })

  it('rule_id_must_exist_in_the_given_ruleset', () => {
    const fixture = firstDecision((f) => f.then.ruleId !== null)
    fixture.then.ruleId = 'missing-rule'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/ruleId/)
  })

  it('no_rule_reason_requires_a_null_rule_id', () => {
    const fixture = firstDecision((f) => f.then.reason === 'no_rule')
    fixture.then.ruleId = fixture.given.ruleset.rules[0]?.id ?? 'any'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/ruleId/)
  })

  it('reason_must_agree_with_access', () => {
    const fixture = firstDecision((f) => f.then.reason === 'schedule_bedtime')
    fixture.then.access = 'allow'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/reason/)
  })

  it('guardian_key_only_at_level_three', () => {
    const fixture = firstDecision((f) => f.then.gate !== undefined && f.then.gate.level < 3)
    if (fixture.then.gate) fixture.then.gate.requiresGuardianKey = true
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/requiresGuardianKey/)
  })

  it('escalation_steps_must_not_go_back_in_time', () => {
    const fixture = firstEscalation()
    const [first, second] = fixture.steps
    if (first && second) second.at = '2020-01-01T00:00:00Z'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/earlier/)
  })

  it('repeated_friction_type_is_reported', () => {
    const fixture = firstEscalation()
    const gates = fixture.steps
      .filter((step) => step.event.type === 'visit')
      .map((step) => step.then.state.gate)
      .filter((gate) => gate !== null)
    const [firstGate, secondGate] = gates
    if (firstGate && secondGate) secondGate.frictionType = firstGate.frictionType
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/frictionType/)
  })

  it('escalation_steps_keep_one_target_group', () => {
    const fixture = firstEscalation()
    const last = fixture.steps.at(-1)
    if (last) last.then.state.targetGroup = 'another-group'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/targetGroup/)
  })

  it('wrong_pulse_is_reported', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find((f) => f.id === 'activity.pulse_formula_matches_rescuetime')
    )
    if (fixture?.operation === 'pulse') fixture.then.pulse = 99
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/pulse/)
  })

  it('blocks_over_the_device_cap_are_reported', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find(
        (f) => f.id === 'activity.cross_device_overlap_is_capped_per_block'
      )
    )
    if (fixture?.operation === 'cross-device-cap') {
      for (const block of fixture.then.blocks) block.seconds = 300
    }
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/300/)
  })

  it('blocks_must_be_totally_ordered_by_source_and_level', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find((f) => f.id === 'activity.split_preserves_total_seconds')
    )
    if (fixture?.operation !== 'blocks') throw new Error('missing blocks fixture')
    const [first] = fixture.then.blocks
    if (!first) throw new Error('no blocks')
    fixture.then.blocks = [
      { ...first, source: 'web', seconds: 1 },
      { ...first, source: 'app', seconds: 1 },
    ]
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/source, level/)
  })

  it('browser_unknown_long_after_the_latest_heartbeat_is_reported', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find(
        (f) => f.id === 'activity.browser_unknown_is_judged_against_the_latest_heartbeat_before_it'
      )
    )
    if (fixture?.operation !== 'browser-dedupe') throw new Error('missing dedupe fixture')
    fixture.then.segments = fixture.then.segments.map((segment) =>
      segment.source === 'app' ? { ...segment, activityKey: 'browser-unknown' } : segment
    )
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/latest heartbeat/)
  })

  it('clipped_web_segment_is_reported', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find(
        (f) => f.id === 'activity.web_segments_are_not_clipped_to_browser_window_time'
      )
    )
    if (fixture?.operation !== 'browser-dedupe') throw new Error('missing dedupe fixture')
    const [web] = fixture.then.segments
    if (web) web.end = '2026-10-26T10:05:00Z'
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/whole/)
  })

  it('rule_change_without_deferral_must_equal_the_new_ruleset', () => {
    const fixture = structuredClone(
      loadFixtures('rule-change').find((f) => f.then.effectiveFrom === null)
    )
    if (fixture) fixture.then.effectiveToday = fixture.given.old
    expect(checkFixtureInvariants(fixture).join('\n')).toMatch(/effectiveToday/)
  })
})
