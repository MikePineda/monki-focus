// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Intentions (SEMANTICS.md §5.2): a friction restriction is lifted while its
 * group's state is `active` and `now < intentionExpiresAt`. Leaving early
 * (`leave`) ends the intention, so it no longer lifts anything.
 */
import type { EscalationState, TargetGroup } from '@monki-focus/rules'
import { escalationStateOf } from './EscalationSession.ts'
import { epochSecondsOf } from './Instant.ts'

export function isIntentionActive(
  states: readonly EscalationState[],
  group: TargetGroup,
  nowSeconds: number
): boolean {
  const state = escalationStateOf(states, group)
  return (
    state.phase === 'active' &&
    state.intentionExpiresAt !== null &&
    nowSeconds < epochSecondsOf(state.intentionExpiresAt)
  )
}
