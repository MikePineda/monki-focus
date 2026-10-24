// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.DecisionState

/*
 * `Decision.validUntil` (SEMANTICS.md §5.6): the earliest instant `t` in
 * `(now, now + 24 h]` at which `decide` with the same inputs returns a
 * decision that differs in any other field, else `now + 24 h`; never later
 * than a waiting rule change (`state.pendingEffectiveFrom`). Adapters re-decide
 * then at the latest instead of polling. It is computed exactly: the decision
 * is evaluated again at every instant where it can change, in order, and the
 * first one that differs wins.
 *
 * A decision before its validity is known (a "timed" decision) is a
 * [Decision] whose `validUntil` is still null, so two of them compare on
 * every other field.
 */

internal const val VALIDITY_HORIZON_SECONDS = 86_400L

internal fun validUntilOf(
    subject: DecisionSubject,
    state: DecisionState,
    decision: Decision,
    nowSeconds: Long,
    decisionAt: (epochSeconds: Long) -> Decision,
): String {
    val pending = state.pendingEffectiveFrom?.let(::epochSecondsOf)
    val dayLater = nowSeconds + VALIDITY_HORIZON_SECONDS
    val horizon = if (pending != null && pending > nowSeconds) minOf(dayLater, pending) else dayLater
    for (instant in changeInstants(subject, state, nowSeconds, horizon)) {
        if (decisionAt(instant) != decision) return utcInstantOf(instant)
    }
    return utcInstantOf(horizon)
}
