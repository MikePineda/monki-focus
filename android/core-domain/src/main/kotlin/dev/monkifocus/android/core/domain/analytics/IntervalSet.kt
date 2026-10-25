// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/*
 * Half-open `[start, end)` intervals in epoch seconds (SEMANTICS.md §1) and
 * the set operations analytics needs: AFK cutting and browser dedupe.
 */

/** Sorted, disjoint, non-empty intervals covering the same time. Touching intervals merge. */
fun unionIntervals(intervals: List<Interval>): List<Interval> {
    val sorted = intervals.filter { it.end > it.start }.sortedWith(compareBy<Interval> { it.start }.thenBy { it.end })
    val merged = mutableListOf<Interval>()
    for (interval in sorted) {
        val last = merged.lastOrNull()
        if (last != null && interval.start <= last.end) {
            merged[merged.lastIndex] = last.copy(end = maxOf(last.end, interval.end))
        } else {
            merged += interval
        }
    }
    return merged
}

/** The time of `minuend` not covered by `subtrahend`, as sorted, disjoint, non-empty intervals. */
fun subtractIntervals(
    minuend: List<Interval>,
    subtrahend: List<Interval>,
): List<Interval> {
    val holes = unionIntervals(subtrahend)
    val result = mutableListOf<Interval>()
    for (interval in unionIntervals(minuend)) {
        var cursor = interval.start
        for (hole in holes) {
            if (hole.end <= cursor) continue
            if (hole.start >= interval.end) break
            if (hole.start > cursor) result += Interval(cursor, hole.start)
            cursor = hole.end
        }
        if (cursor < interval.end) result += Interval(cursor, interval.end)
    }
    return result
}

/** The time an event covers. */
internal fun intervalOf(event: ActivityEvent): Interval {
    val start = epochSecondsOf(event.timestamp)
    return Interval(start, start + event.duration)
}
