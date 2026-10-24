// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { EscalationEvent, EscalationPhase } from '@monki-focus/rules'
import { nextEscalation } from '../../src/index.ts'
import { makeEscalation } from '../factories/RulesetFactory.ts'

const NOW = '2026-10-26T10:00:00Z'
const commit = (typedWords: number, guardianKeyVerified = false): EscalationEvent => ({
  type: 'commit',
  minutes: 5,
  typedWords,
  guardianKeyVerified,
})

describe('EscalationPolicy', () => {
  it.each<[EscalationPhase, EscalationEvent['type']]>([
    ['idle', 'pause_elapsed'],
    ['idle', 'close'],
    ['idle', 'intention_expired'],
    ['idle', 'leave'],
    ['idle', 'extend'],
    ['idle', 'emergency_wait_elapsed'],
    ['idle', 'emergency_expired'],
    ['pausing', 'visit'],
    ['asking', 'visit'],
    ['timed_out', 'visit'],
    ['override_waiting', 'visit'],
    ['override_waiting', 'emergency_request'],
    ['active', 'emergency_request'],
  ])('an_event_that_does_not_apply_in_%s_ignores_%s', (phase, type) => {
    const state = makeEscalation('r-x', { phase, lastActivityAt: '2026-10-26T09:59:00Z' })
    expect(nextEscalation(state, { type } as EscalationEvent, NOW, false)).toEqual({
      state,
      effects: [],
    })
  })

  it('a_commit_outside_asking_is_ignored', () => {
    const state = makeEscalation('r-x', { phase: 'idle' })
    expect(nextEscalation(state, commit(5), NOW, false).state).toBe(state)
  })

  it('a_visit_after_an_override_ran_out_starts_a_new_attempt', () => {
    const state = makeEscalation('r-x', {
      phase: 'override_active',
      lastActivityAt: '2026-10-26T09:50:00Z',
      overrideReadyAt: '2026-10-26T09:43:00Z',
      overrideEndsAt: '2026-10-26T09:58:00Z',
    })
    const { state: next } = nextEscalation(state, { type: 'visit' }, NOW, false)
    expect(next).toMatchObject({
      phase: 'pausing',
      attemptCount: 1,
      overrideReadyAt: null,
      overrideEndsAt: null,
      pauseEndsAt: '2026-10-26T10:00:05Z',
    })
  })

  it('a_visit_during_a_current_override_changes_nothing', () => {
    const state = makeEscalation('r-x', {
      phase: 'override_active',
      overrideEndsAt: '2026-10-26T10:05:00Z',
    })
    expect(nextEscalation(state, { type: 'visit' }, NOW, false).state).toBe(state)
  })

  it('a_commit_without_a_verified_guardian_key_is_ignored_when_the_gate_requires_it', () => {
    const state = makeEscalation('r-x', {
      phase: 'asking',
      attemptCount: 4,
      lastFrictionType: 'countdown',
      gate: {
        level: 3,
        pauseSeconds: 15,
        frictionType: 'countdown',
        requiresTypedIntention: true,
        requiresGuardianKey: true,
      },
    })
    expect(nextEscalation(state, commit(3), NOW, true).state).toBe(state)
    expect(nextEscalation(state, commit(3, true), NOW, true).state.phase).toBe('active')
  })

  it('a_commit_in_asking_without_a_stored_gate_needs_nothing_more', () => {
    const state = makeEscalation('r-x', { phase: 'asking' })
    expect(nextEscalation(state, commit(0), NOW, false).state).toMatchObject({
      phase: 'active',
      intentionExpiresAt: '2026-10-26T10:05:00Z',
    })
  })

  it('an_emergency_request_from_a_gate_waits_two_minutes', () => {
    const state = makeEscalation('r-x', { phase: 'asking' })
    expect(nextEscalation(state, { type: 'emergency_request' }, NOW, false).state).toMatchObject({
      phase: 'override_waiting',
      overrideReadyAt: '2026-10-26T10:02:00Z',
      lastActivityAt: NOW,
    })
  })

  it('closing_while_an_override_waits_returns_to_idle_without_timers', () => {
    const state = makeEscalation('r-x', {
      phase: 'override_waiting',
      overrideReadyAt: '2026-10-26T10:02:00Z',
    })
    expect(nextEscalation(state, { type: 'close' }, NOW, false).state).toMatchObject({
      phase: 'idle',
      overrideReadyAt: null,
    })
  })

  it('leaving_an_active_intention_early_ends_it', () => {
    const state = makeEscalation('r-x', {
      phase: 'active',
      intentionExpiresAt: '2026-10-26T10:05:00Z',
    })
    expect(nextEscalation(state, { type: 'leave' }, NOW, false).state).toMatchObject({
      phase: 'idle',
      intentionExpiresAt: null,
    })
  })
})
