// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loadFixtures, schemaValidator } from '../../src/index.ts'

function isValidFixture(fixture: unknown): boolean {
  return schemaValidator().validate('fixture', fixture).valid
}

function decisionWith(mutate: (fixture: Record<string, unknown>) => void): unknown {
  const fixture = structuredClone(loadFixtures('decision')[0]) as unknown as Record<string, unknown>
  mutate(fixture)
  return fixture
}

describe('fixture schemas', () => {
  it('gate_decision_requires_gate_details', () => {
    const gated = loadFixtures('decision').find((f) => f.then.access === 'gate')
    const fixture = structuredClone(gated)
    if (fixture) delete fixture.then.gate
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('non_gate_decision_carries_no_gate_details', () => {
    const allowed = loadFixtures('decision').find((f) => f.then.access === 'allow')
    const fixture = structuredClone(allowed)
    if (fixture) {
      fixture.then.gate = {
        level: 0,
        pauseSeconds: 5,
        frictionType: 'countdown',
        requiresTypedIntention: false,
        requiresGuardianKey: false,
      }
    }
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('unknown_reason_code_is_rejected', () => {
    expect(
      isValidFixture(
        decisionWith((f) => {
          ;(f.then as Record<string, unknown>).reason = 'because'
        })
      )
    ).toBe(false)
  })

  it('pause_over_60_seconds_is_rejected', () => {
    const gated = structuredClone(loadFixtures('decision').find((f) => f.then.gate !== undefined))
    if (gated?.then.gate) gated.then.gate.pauseSeconds = 61
    expect(isValidFixture(gated)).toBe(false)
  })

  it('decision_id_must_be_prefixed_by_its_kind', () => {
    expect(
      isValidFixture(
        decisionWith((f) => {
          f.id = 'most_specific_rule_wins'
        })
      )
    ).toBe(false)
  })

  it('escalation_needs_at_least_two_steps', () => {
    const fixture = structuredClone(loadFixtures('escalation')[0])
    if (fixture) fixture.steps = fixture.steps.slice(0, 1)
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('computed_instants_must_be_utc', () => {
    const fixture = structuredClone(loadFixtures('escalation')[0])
    const first = fixture?.steps[0]
    if (first) first.then.state.lastAttemptAt = '2026-10-26T10:00:00+11:00'
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('block_over_300_seconds_is_rejected', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find((f) => f.operation === 'cross-device-cap')
    )
    if (fixture?.operation === 'cross-device-cap') {
      const first = fixture.then.blocks[0]
      if (first) first.seconds = 301
    }
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('block_start_must_be_aligned_to_five_minutes', () => {
    const fixture = structuredClone(
      loadFixtures('activity').find((f) => f.operation === 'cross-device-cap')
    )
    if (fixture?.operation === 'cross-device-cap') {
      const first = fixture.then.blocks[0]
      if (first) first.blockStart = '2026-10-26T09:03:00Z'
    }
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('synced_block_cannot_carry_a_title_or_url', () => {
    const fixture = structuredClone(loadFixtures('activity').find((f) => f.operation === 'blocks'))
    if (fixture?.operation === 'blocks') {
      const first = fixture.then.blocks[0] as Record<string, unknown> | undefined
      if (first) first.url = 'https://www.reddit.com/r/MachineLearning/'
    }
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('activity_operation_must_be_known', () => {
    const fixture = structuredClone(loadFixtures('activity')[0]) as unknown as Record<
      string,
      unknown
    >
    fixture.operation = 'guess'
    expect(isValidFixture(fixture)).toBe(false)
  })

  it('schedule_fixture_cannot_mix_schedule_and_bedtime_shapes', () => {
    const bedtime = loadFixtures('schedule').find((f) => 'bedtime' in f.given)
    const fixture = structuredClone(bedtime) as unknown as Record<string, unknown>
    fixture.then = { active: true }
    expect(isValidFixture(fixture)).toBe(false)
  })
})
