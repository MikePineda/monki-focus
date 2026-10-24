// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

/** How an intention ended, with its stored code. */
enum class IntentionOutcome(
    val code: String,
) {
    /** The user left before or when the time was up. */
    KEPT("kept"),

    /** The user stayed past the time (or extended it). */
    BROKEN("broken"),

    /** The intention was dropped without an answer (service restart, rule removed). */
    ABANDONED("abandoned"),
    ;

    companion object {
        fun ofCode(code: String): IntentionOutcome =
            entries.firstOrNull { it.code == code } ?: throw IllegalArgumentException("Unknown intention outcome")
    }
}
