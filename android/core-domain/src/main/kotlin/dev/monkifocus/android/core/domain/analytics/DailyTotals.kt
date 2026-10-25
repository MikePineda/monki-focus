// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.localTimeAt
import dev.monkifocus.android.core.domain.engine.nextLocalMidnight

/*
 * Daily totals (SEMANTICS.md §10.7): intervals are split at local midnight
 * in the pinned time zone (the engine's zoned time, never the device zone);
 * per local date the total, the seconds by level and the pulse. Only dates
 * with time appear, ascending.
 */

private val LEVELS: List<Int> = listOf(0, 25, 50, 75, 100)

fun dailyTotals(
    entries: List<LevelledInterval>,
    timeZone: String,
): List<DailyTotal> {
    val days = HashMap<String, LongArray>()
    for (entry in entries) {
        var cursor = epochSecondsOf(entry.timestamp)
        val end = cursor + entry.duration
        while (cursor < end) {
            val pieceEnd = minOf(nextLocalMidnight(cursor, timeZone), end)
            val date = localTimeAt(cursor, timeZone).localDate
            days.getOrPut(date) { LongArray(LEVELS.size) }[LEVELS.indexOf(entry.level)] += pieceEnd - cursor
            cursor = pieceEnd
        }
    }
    return days.entries
        .sortedBy { it.key }
        .map { (date, seconds) ->
            val levelled = LEVELS.mapIndexed { index, level -> PulseInput(seconds[index], level) }
            DailyTotal(
                date = date,
                seconds = seconds.sum(),
                secondsByLevel = levelled.associate { it.level to it.seconds },
                pulse = pulse(levelled),
            )
        }
}
