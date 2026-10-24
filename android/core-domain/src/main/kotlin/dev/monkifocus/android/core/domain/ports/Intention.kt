// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * One intention the user committed to at a gate (SEMANTICS.md §5.2, §7.3
 * `commit`). Like the engine, the store never sees the typed text: only how
 * many words were typed. Instants are UTC RFC 3339 text.
 */
data class Intention(
    val id: String,
    val targetGroup: String,
    val minutes: Int,
    val typedWords: Int,
    val guardianKeyVerified: Boolean,
    val startedAt: String,
    val endsAt: String,
    val outcome: IntentionOutcome? = null,
    val closedAt: String? = null,
) {
    init {
        require(id.isNotEmpty()) { "Empty intention id" }
        require(minutes > 0 && typedWords >= 0) { "Invalid intention counts" }
        require(epochSecondsOf(startedAt) <= epochSecondsOf(endsAt)) { "Intention ends before it starts" }
        require((outcome == null) == (closedAt == null)) { "An outcome and its instant go together" }
        closedAt?.let(::epochSecondsOf)
    }
}
