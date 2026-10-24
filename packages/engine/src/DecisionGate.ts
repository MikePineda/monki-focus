// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gate `decide` returns for a friction restriction without a lift
 * (SEMANTICS.md §7.4):
 *
 * - in `pausing` or `asking`: the winner group's current gate;
 * - in `timed_out` or `override_waiting` (a visit changes nothing there): the
 *   current gate without a new attempt;
 * - otherwise the gate a `visit` would produce now, on the **effective
 *   state**: escalation is shared by every matching friction candidate, so a
 *   new rule id never resets it. Adapters call `nextEscalation` for the
 *   winner's group with that effective state (`effectiveEscalationState`), so
 *   the stored gate equals the returned one.
 */
import type { EscalationState, Gate, Rule } from '@monki-focus/rules'
import { visitOutcome } from './EscalationPolicy.ts'
import { escalationStateOf, sessionCounters } from './EscalationSession.ts'
import { fullGate } from './GateCalculator.ts'
import { epochSecondsOf } from './Instant.ts'

function lastActivitySeconds(state: EscalationState): number {
  return state.lastActivityAt === null
    ? Number.NEGATIVE_INFINITY
    : epochSecondsOf(state.lastActivityAt)
}

/**
 * The winner group's state with the counters every matching friction group
 * shares: the maxima of the session-checked counters, and the friction type
 * of the group with the latest activity (ties: the winner's, then the
 * smallest rule id).
 */
export function effectiveEscalationState(
  winner: Rule,
  frictionRules: readonly Rule[],
  states: readonly EscalationState[],
  nowSeconds: number
): EscalationState {
  const own = escalationStateOf(states, winner.id)
  // Other groups in id order, so a tie between them never depends on rule order.
  const others = frictionRules
    .filter((rule) => rule.id !== winner.id)
    .map((rule) => rule.id)
    .sort()
    .map((id) => escalationStateOf(states, id))
  const groups = [own, ...others]
  let attemptCount = 0
  let brokenCount = 0
  let latest = own
  for (const state of groups) {
    const counters = sessionCounters(state, nowSeconds)
    attemptCount = Math.max(attemptCount, counters.attemptCount)
    brokenCount = Math.max(brokenCount, counters.brokenCount)
    if (lastActivitySeconds(state) > lastActivitySeconds(latest)) latest = state
  }
  // Counters are already session-checked: the visit must not reset them again.
  return {
    ...own,
    attemptCount,
    brokenCount,
    lastFrictionType: latest.lastFrictionType,
    lastActivityAt: null,
  }
}

export function decisionGate(
  winner: Rule,
  frictionRules: readonly Rule[],
  states: readonly EscalationState[],
  nowSeconds: number,
  guardianLinked: boolean
): Gate {
  const own = escalationStateOf(states, winner.id)
  if ((own.phase === 'pausing' || own.phase === 'asking') && own.gate !== null) return own.gate
  if (own.phase === 'timed_out' || own.phase === 'override_waiting') {
    return fullGate(
      own.attemptCount,
      own.brokenCount,
      own.lastFrictionType ?? 'countdown',
      guardianLinked
    )
  }
  const effective = effectiveEscalationState(winner, frictionRules, states, nowSeconds)
  return visitOutcome(effective, nowSeconds, guardianLinked).gate
}
