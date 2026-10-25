// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.EventData
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf

/**
 * Sessions and away periods as ActivityWatch events and back. Instants are
 * floored to whole seconds (start and end alike), so the same session always
 * gives the same row and an open session that grows keeps its natural key.
 */
object UsageEventRows {
    fun of(session: ForegroundSession): ActivityEvent =
        event(session.startMillis, session.endMillis, EventData.Window(app = session.packageName))

    fun of(period: AfkPeriod): ActivityEvent = event(period.startMillis, period.endMillis, EventData.Afk(period.status))

    /** The stored event of [events] whose time covers [atMillis], or null. */
    fun inEffectAt(
        events: List<ActivityEvent>,
        atMillis: Long,
    ): ActivityEvent? = events.lastOrNull { startMillisOf(it) <= atMillis && atMillis < endMillisOf(it) }

    fun startMillisOf(event: ActivityEvent): Long = epochSecondsOf(event.timestamp) * MILLIS_PER_SECOND

    fun endMillisOf(event: ActivityEvent): Long = (epochSecondsOf(event.timestamp) + event.duration) * MILLIS_PER_SECOND

    private fun event(
        startMillis: Long,
        endMillis: Long,
        data: EventData,
    ): ActivityEvent {
        val start = Math.floorDiv(startMillis, MILLIS_PER_SECOND)
        val end = Math.floorDiv(endMillis, MILLIS_PER_SECOND)
        return ActivityEvent(timestamp = utcInstantOf(start), duration = (end - start).toInt(), data = data)
    }

    private const val MILLIS_PER_SECOND = 1_000L
}
