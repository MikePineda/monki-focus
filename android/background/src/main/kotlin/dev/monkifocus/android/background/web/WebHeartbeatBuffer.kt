// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.heartbeat
import dev.monkifocus.android.core.domain.engine.epochSecondsOf

/**
 * Merges the accessibility service's URL-bar heartbeats in memory with the
 * analytics core's `heartbeat` (SEMANTICS.md §10.1) and says which events to
 * write, so a burst of screen reads costs one write per [flushEverySeconds]
 * instead of one per read. Pure, not thread-safe.
 *
 * Every event handed out keeps its start, so writing it again replaces the
 * stored row (the store keeps the longer duration per natural key). An
 * unflushed tail is at most [flushEverySeconds] long and is lost only when
 * the process dies.
 */
class WebHeartbeatBuffer(
    private val pulsetimeSeconds: Long = PULSETIME_SECONDS,
    private val flushEverySeconds: Long = FLUSH_EVERY_SECONDS,
) {
    private var open: ActivityEvent? = null
    private var flushedEnd = Long.MIN_VALUE

    /** Takes one heartbeat; answers the events to write now (possibly none). */
    fun offer(beat: ActivityEvent): List<ActivityEvent> {
        val merged = heartbeat(open, beat, pulsetimeSeconds)
        if (merged != null) {
            open = merged
            val end = endOf(merged)
            if (end - flushedEnd < flushEverySeconds) return emptyList()
            flushedEnd = end
            return listOf(merged)
        }
        val closed = open?.takeIf { endOf(it) > flushedEnd }
        open = beat
        flushedEnd = endOf(beat)
        return listOfNotNull(closed, beat)
    }

    private fun endOf(event: ActivityEvent): Long = epochSecondsOf(event.timestamp) + event.duration

    companion object {
        /**
         * The service reads the URL bar on screen changes, not on a timer: a
         * page read without scrolling sends nothing, so heartbeats of the same
         * page up to a minute apart still extend one event.
         */
        const val PULSETIME_SECONDS = 60L
        const val FLUSH_EVERY_SECONDS = 10L
    }
}
