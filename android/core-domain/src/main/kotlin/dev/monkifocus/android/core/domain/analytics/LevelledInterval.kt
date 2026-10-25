// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/** `activity-fixture.schema.json` `LevelledInterval`: tracked time at one productivity level. */
data class LevelledInterval(
    val timestamp: String,
    val duration: Int,
    val level: Int,
) {
    init {
        epochSecondsOf(timestamp)
        require(duration in 0..ActivityEvent.MAX_DURATION_SECONDS) { "duration out of range" }
        require(level in ActivityBlock.LEVELS) { "level must be 0, 25, 50, 75 or 100" }
    }
}
