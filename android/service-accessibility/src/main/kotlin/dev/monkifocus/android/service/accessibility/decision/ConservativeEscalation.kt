// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.engine.initialEscalationState
import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * The escalation state a gated group starts from while its stored state is
 * unknown (not read yet, or storage failing after retries): two attempts
 * already counted and no quiet time, so the next visit is level 2, a typed
 * intention (SEMANTICS.md §7.1). Losing the store must never reset the
 * friction to its gentlest step.
 */
object ConservativeEscalation {
    const val ATTEMPTS = 2

    fun of(group: String): EscalationState = initialEscalationState(group).copy(attemptCount = ATTEMPTS)
}
