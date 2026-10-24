// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * Emergency overrides (SEMANTICS.md §5.2, §13.7): scoped to one group (the
 * rule id, or `bedtime`). The group's state lifts its restriction while it is
 * `override_active` and `now < overrideEndsAt`.
 */
internal fun isOverrideActive(
    states: List<EscalationState>,
    group: String,
    nowSeconds: Long,
): Boolean {
    val state = escalationStateOf(states, group)
    val endsAt = state.overrideEndsAt
    return state.phase == EscalationPhase.OVERRIDE_ACTIVE && endsAt != null && nowSeconds < epochSecondsOf(endsAt)
}
