// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/*
 * ActivityWatch heartbeat merging (SEMANTICS.md §10.1): a heartbeat with
 * equal data that starts inside `[last.timestamp, last end + pulsetime]`
 * extends the last event; anything else opens a new event. Event data are
 * flat data classes, so `==` is the deep equality aw-server uses.
 */

/** The last event extended by `next`, or null when `next` must open a new event. Pure. */
fun heartbeat(
    last: ActivityEvent?,
    next: ActivityEvent,
    pulsetime: Long,
): ActivityEvent? {
    if (last == null || last.data != next.data) return null
    val lastStart = epochSecondsOf(last.timestamp)
    val nextStart = epochSecondsOf(next.timestamp)
    if (nextStart < lastStart || nextStart > lastStart + last.duration + pulsetime) return null
    val duration = maxOf(last.duration.toLong(), nextStart + next.duration - lastStart)
    return ActivityEvent(timestamp = last.timestamp, duration = eventSecondsOf(duration), data = last.data)
}

/** Applies `heartbeats` in order to a bucket's `events`, as aw-server does. */
fun mergeHeartbeats(
    events: List<ActivityEvent>,
    heartbeats: List<ActivityEvent>,
    pulsetime: Long,
): List<ActivityEvent> {
    val result = events.toMutableList()
    for (next in heartbeats) {
        val merged = heartbeat(result.lastOrNull(), next, pulsetime)
        if (merged == null) result += next else result[result.lastIndex] = merged
    }
    return result
}

/** A computed duration as an event duration: rejected, never wrapped, beyond the schema maximum. */
internal fun eventSecondsOf(duration: Long): Int {
    require(duration in 0..ActivityEvent.MAX_DURATION_SECONDS) { "duration out of range" }
    return duration.toInt()
}
