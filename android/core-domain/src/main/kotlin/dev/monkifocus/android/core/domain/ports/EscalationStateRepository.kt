// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.rules.EscalationState

/**
 * The escalation state machine of every target group (SEMANTICS.md §7), one
 * state per group. A group without a stored state is in the initial state
 * (`idle`, counters 0); callers create it, the store never invents one.
 */
interface EscalationStateRepository {
    /** Every stored state, by target group. */
    suspend fun all(): List<EscalationState>

    suspend fun get(targetGroup: String): EscalationState?

    /** Stores [state], replacing the group's previous one. */
    suspend fun put(state: EscalationState)

    /** Stores every state of [states] atomically (one `decide` step may move several groups). */
    suspend fun putAll(states: List<EscalationState>)

    /** Forgets a group (its rule was deleted); answers whether it existed. */
    suspend fun remove(targetGroup: String): Boolean
}
