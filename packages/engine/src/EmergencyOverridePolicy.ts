// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Emergency overrides (SEMANTICS.md §5.2, §13.7): scoped to one group (the
 * rule id, or `bedtime`). The group's state lifts its restriction while it is
 * `override_active` and `now < overrideEndsAt`.
 */
import type { EscalationState, TargetGroup } from '@monki-focus/rules'
import { escalationStateOf } from './EscalationSession.ts'
import { epochSecondsOf } from './Instant.ts'

export function isOverrideActive(
  states: readonly EscalationState[],
  group: TargetGroup,
  nowSeconds: number
): boolean {
  const state = escalationStateOf(states, group)
  return (
    state.phase === 'override_active' &&
    state.overrideEndsAt !== null &&
    nowSeconds < epochSecondsOf(state.overrideEndsAt)
  )
}
