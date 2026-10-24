// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * Intentions (SEMANTICS.md §5.2): a friction restriction is lifted while its
 * group's state is `active` and `now < intentionExpiresAt`. Leaving early
 * (`leave`) ends the intention, so it no longer lifts anything.
 */
internal fun isIntentionActive(
    states: List<EscalationState>,
    group: String,
    nowSeconds: Long,
): Boolean {
    val state = escalationStateOf(states, group)
    val expiresAt = state.intentionExpiresAt
    return state.phase == EscalationPhase.ACTIVE && expiresAt != null && nowSeconds < epochSecondsOf(expiresAt)
}
