// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * `activity.schema.json#/$defs/attributedEvent`: a categorised, non-idle
 * stretch of time ready to be cut into blocks (SEMANTICS.md §10.6). `title`
 * and `url` may exist locally and never reach a block; `toString` never
 * prints them.
 */
data class AttributedEvent(
    val timestamp: String,
    val duration: Int,
    val source: ActivitySource,
    val activityKey: String,
    val categoryPath: String,
    val level: Int,
    val title: String? = null,
    val url: String? = null,
) {
    init {
        epochSecondsOf(timestamp)
        require(duration in 0..ActivityEvent.MAX_DURATION_SECONDS) { "duration out of range" }
        require(level in ActivityBlock.LEVELS) { "level must be 0, 25, 50, 75 or 100" }
    }

    override fun toString(): String =
        "AttributedEvent(timestamp=$timestamp, duration=$duration, source=$source, activityKey=$activityKey, " +
            "categoryPath=$categoryPath, level=$level)"
}
