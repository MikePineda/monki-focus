// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.ports.IntentionOutcome

/**
 * Port: the intention history of the local statistics (Room
 * `IntentionRepository`). It never receives the typed text: only the minutes
 * and the word count. Instants are UTC RFC 3339 text.
 */
interface IntentionLog {
    fun started(
        group: String,
        minutes: Int,
        typedWords: Int,
        startedAt: String,
        endsAt: String,
    )

    fun ended(
        group: String,
        outcome: IntentionOutcome,
        at: String,
    )
}
