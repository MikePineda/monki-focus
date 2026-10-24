// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The escalation session (SEMANTICS.md §7.2): attempts count in a session
 * that resets when a `visit` arrives at least 2 hours after `lastActivityAt`
 * (the last escalation event of any kind). There is no reset at midnight.
 */
import type { EscalationState, TargetGroup } from '@monki-focus/rules'
import { epochSecondsOf } from './Instant.ts'

export const SESSION_QUIET_SECONDS = 7200

export function initialEscalationState(targetGroup: TargetGroup): EscalationState {
  return {
    targetGroup,
    phase: 'idle',
    attemptCount: 0,
    lastAttemptAt: null,
    lastActivityAt: null,
    brokenCount: 0,
    lastFrictionType: null,
    gate: null,
    pauseEndsAt: null,
    pendingExtension: false,
    intentionExpiresAt: null,
    overrideReadyAt: null,
    overrideEndsAt: null,
  }
}

/** The stored state of a group, or the initial idle state when the group has none. */
export function escalationStateOf(
  states: readonly EscalationState[],
  targetGroup: TargetGroup
): EscalationState {
  return (
    states.find((state) => state.targetGroup === targetGroup) ?? initialEscalationState(targetGroup)
  )
}

/** Counters a visit at `nowSeconds` starts from: zero after two quiet hours. */
export function sessionCounters(
  state: EscalationState,
  nowSeconds: number
): { attemptCount: number; brokenCount: number } {
  const quiet =
    state.lastActivityAt !== null &&
    nowSeconds - epochSecondsOf(state.lastActivityAt) >= SESSION_QUIET_SECONDS
  return quiet
    ? { attemptCount: 0, brokenCount: 0 }
    : { attemptCount: state.attemptCount, brokenCount: state.brokenCount }
}
