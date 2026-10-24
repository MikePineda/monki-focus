// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.DailyWindowSpec

/*
 * When a waiting rule change takes effect (SEMANTICS.md §8):
 *
 * 1. the next local midnight after `now` (the later one across both zones
 *    while a zone change waits);
 * 2. the first instant at or after it that lies in no old window of a
 *    waiting part (in either zone): the end of the union of the half-open
 *    windows that chain from it, however many there are. This is a time
 *    bound, never a round count: the result is never later than `now` +
 *    8 days, and exactly that when the union still covers it (24-hour windows
 *    on every day never end);
 * 3. never earlier than the pending change's `effectiveFrom`.
 */

/** Step 2 never pushes `effectiveFrom` more than 8 days after `now`. */
internal const val MAX_DEFERRAL_SECONDS = 8 * SECONDS_PER_DAY

/** End instants of the windows active at `epochSeconds` in any of the zones. */
private fun activeWindowEnds(
    epochSeconds: Long,
    zones: List<String>,
    windows: List<DailyWindowSpec>,
): List<Long> =
    zones.flatMap { zone ->
        val local = localTimeAt(epochSeconds, zone)
        windows.mapNotNull { window ->
            occurrenceAt(window, local)?.let { occurrence ->
                val endMinute = occurrence.startDayNumber * MINUTES_PER_DAY + occurrence.startMinute + occurrence.lengthMinutes
                firstInstantReachingWall(epochSeconds, endMinute * 60, zone)
            }
        }
    }

internal fun effectiveFromOf(
    nowSeconds: Long,
    zones: List<String>,
    windows: List<DailyWindowSpec>,
    pendingSeconds: Long?,
): Long {
    val latest = nowSeconds + MAX_DEFERRAL_SECONDS
    var instant = zones.maxOf { zone -> nextLocalMidnight(nowSeconds, zone) }
    // Each step jumps to the end of a window covering `instant`, so it strictly advances.
    while (instant < latest) {
        val ends = activeWindowEnds(instant, zones, windows)
        if (ends.isEmpty()) break
        instant = ends.max()
    }
    val bounded = minOf(instant, latest)
    return if (pendingSeconds == null) bounded else maxOf(bounded, pendingSeconds)
}
