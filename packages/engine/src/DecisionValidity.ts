// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `Decision.validUntil` (SEMANTICS.md §5.6): the earliest instant `t` in
 * `(now, now + 24 h]` at which `decide` with the same inputs returns a
 * decision that differs in any other field, else `now + 24 h`; never later
 * than a waiting rule change (`state.pendingEffectiveFrom`). Adapters re-decide
 * then at the latest instead of polling. It is computed exactly: the decision
 * is evaluated again at every instant where it can change, in order, and the
 * first one that differs wins.
 */
import type { Decision, DecisionState, UtcInstant } from '@monki-focus/rules'
import { changeInstants } from './DecisionChangeInstants.ts'
import type { DecisionSubject } from './DecisionCandidates.ts'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'
import { jsonEqual } from './JsonEquality.ts'

/** A decision before its validity is known. */
export type TimedDecision = Omit<Decision, 'validUntil'>

export const VALIDITY_HORIZON_SECONDS = 86_400

export function validUntilOf(
  inputs: { subject: DecisionSubject; state: DecisionState },
  decision: TimedDecision,
  nowSeconds: number,
  decisionAt: (epochSeconds: number) => TimedDecision
): UtcInstant {
  const { subject, state } = inputs
  const pending =
    state.pendingEffectiveFrom === undefined || state.pendingEffectiveFrom === null
      ? Number.POSITIVE_INFINITY
      : epochSecondsOf(state.pendingEffectiveFrom)
  const horizon = Math.min(
    nowSeconds + VALIDITY_HORIZON_SECONDS,
    pending > nowSeconds ? pending : Number.POSITIVE_INFINITY
  )
  for (const instant of changeInstants(subject, state, nowSeconds, horizon)) {
    if (!jsonEqual(decisionAt(instant), decision)) return utcInstantOf(instant)
  }
  return utcInstantOf(horizon)
}
