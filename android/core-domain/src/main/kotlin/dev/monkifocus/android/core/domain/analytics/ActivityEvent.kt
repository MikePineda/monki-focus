// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * `activity.schema.json#/$defs/event`: an ActivityWatch event
 * `{timestamp, duration, data}` with a UTC instant (`2026-10-25T23:00:00Z`)
 * and a whole-second duration (SEMANTICS.md §10).
 */
data class ActivityEvent(
    val timestamp: String,
    val duration: Int,
    val data: EventData,
) {
    init {
        epochSecondsOf(timestamp)
        require(duration in 0..MAX_DURATION_SECONDS) { "duration out of range" }
    }

    companion object {
        /** `activity.schema.json#/$defs/seconds` maximum (366 days). */
        const val MAX_DURATION_SECONDS = 31_622_400
    }
}
