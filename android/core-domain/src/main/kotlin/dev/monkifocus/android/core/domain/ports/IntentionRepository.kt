// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** Intentions and how they ended, for the gate and the local statistics. */
interface IntentionRepository {
    /** Stores a new, open intention; an id that already exists is an error. */
    suspend fun start(intention: Intention)

    /**
     * Closes the open intention [id] with [outcome] at [closedAt]. Answers
     * false (and changes nothing) when it is unknown or already closed: an
     * outcome is written once.
     */
    suspend fun close(
        id: String,
        outcome: IntentionOutcome,
        closedAt: String,
    ): Boolean

    /** The latest open intention of [targetGroup], or null. */
    suspend fun open(targetGroup: String): Intention?

    /** Intentions started in `[from, to)`, oldest first. */
    suspend fun startedBetween(
        from: String,
        to: String,
    ): List<Intention>
}
