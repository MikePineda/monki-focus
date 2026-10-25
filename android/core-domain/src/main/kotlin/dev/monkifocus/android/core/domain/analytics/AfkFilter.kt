// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.utcInstantOf

/*
 * Active time (SEMANTICS.md §10.3): events are cut to the time not covered
 * by AFK events with status `afk`. Audible web events are kept whole (a
 * lecture playing while the user listens).
 */

/** Active pieces in timestamp order (stable); zero-length pieces are dropped. */
fun activeTime(
    events: List<ActivityEvent>,
    afkEvents: List<ActivityEvent>,
): List<ActivityEvent> {
    val away = afkEvents.filter { (it.data as? EventData.Afk)?.status == AfkStatus.AFK }.map(::intervalOf)
    return events
        .flatMap { event ->
            val keepWhole = (event.data as? EventData.WebTab)?.audible == true
            subtractIntervals(listOf(intervalOf(event)), if (keepWhole) emptyList() else away).map { piece -> piece to event.data }
        }.sortedBy { (piece, _) -> piece.start }
        .map { (piece, data) -> ActivityEvent(utcInstantOf(piece.start), eventSecondsOf(piece.end - piece.start), data) }
}
