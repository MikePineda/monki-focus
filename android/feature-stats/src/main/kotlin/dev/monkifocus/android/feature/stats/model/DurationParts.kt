// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

/** Seconds as whole hours and minutes for display (rounded to the nearest minute). */
data class DurationParts(
    val hours: Long,
    val minutes: Long,
) {
    companion object {
        fun of(seconds: Long): DurationParts {
            val totalMinutes = (seconds.coerceAtLeast(0) + HALF_MINUTE) / SECONDS_PER_MINUTE
            return DurationParts(totalMinutes / MINUTES_PER_HOUR, totalMinutes % MINUTES_PER_HOUR)
        }

        private const val SECONDS_PER_MINUTE = 60L
        private const val HALF_MINUTE = 30L
        private const val MINUTES_PER_HOUR = 60L
    }
}
