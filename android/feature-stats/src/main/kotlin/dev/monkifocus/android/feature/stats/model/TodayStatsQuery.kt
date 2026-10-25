// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.PulseInput
import dev.monkifocus.android.core.domain.analytics.UNCATEGORISED
import dev.monkifocus.android.core.domain.analytics.pulse
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome

/**
 * Today's summary from the local 5-minute blocks and the gate's intentions,
 * the extension's `TodayStatsQuery` on Android. Pure: callers pass the
 * candidates (blocks and intentions of roughly the last 27 hours) and
 * everything is filtered to today's local date in [timeZone].
 */
object TodayStatsQuery {
    const val TOP_ACTIVITIES = 10

    /** A local day lasts at most 25 hours; callers read this far back and the date filter does the rest. */
    const val LOOKBACK_SECONDS = 27 * 3_600L

    fun compute(
        blocks: List<ActivityBlock>,
        intentions: List<Intention>,
        nowEpochSeconds: Long,
        timeZone: String,
    ): TodayStats {
        val calendar = LocalCalendar(timeZone)
        val today = calendar.at(nowEpochSeconds).dayNumber
        val todays = blocks.filter { calendar.at(epochSecondsOf(it.blockStart)).dayNumber == today }
        val byLevel = LongArray(LEVEL_COUNT)
        var uncategorised = 0L
        for (block in todays) {
            when (block.categoryPath) {
                UNCATEGORISED.categoryPath -> uncategorised += block.seconds
                else -> byLevel[levelIndexOf(block.level)] += block.seconds
            }
        }
        val started = intentions.filter { calendar.at(epochSecondsOf(it.startedAt)).dayNumber == today }
        return TodayStats(
            date = LocalCalendar.dateOf(today),
            pulse = pulse(todays.map { PulseInput(it.seconds.toLong(), it.level) }),
            totalSeconds = todays.sumOf { it.seconds.toLong() },
            secondsByLevel = byLevel.toList(),
            uncategorisedSeconds = uncategorised,
            topActivities = topActivities(todays),
            intentions =
                TodayStats.IntentionSummary(
                    total = started.size,
                    kept = started.count { it.outcome == IntentionOutcome.KEPT },
                    broken = started.count { it.outcome == IntentionOutcome.BROKEN },
                    abandoned = started.count { it.outcome == IntentionOutcome.ABANDONED },
                ),
        )
    }

    /** Level index 0..4 of an analytics level (0, 25, 50, 75, 100). */
    fun levelIndexOf(level: Int): Int = (level / LEVEL_STEP).coerceIn(0, LEVEL_COUNT - 1)

    private fun topActivities(blocks: List<ActivityBlock>): List<TodayStats.TopActivity> =
        blocks
            .filter { it.activityKey != null }
            .groupBy { requireNotNull(it.activityKey) }
            .map { (key, group) ->
                // The level with the most seconds; on a tie the lower (more distracting) one.
                val level =
                    group
                        .groupBy { it.level }
                        .mapValues { (_, b) -> b.sumOf { it.seconds } }
                        .entries
                        .sortedWith(compareByDescending<Map.Entry<Int, Int>> { it.value }.thenBy { it.key })
                        .first()
                        .key
                val source =
                    group
                        .groupBy { it.source }
                        .maxBy { (_, b) -> b.sumOf { it.seconds } }
                        .key
                TodayStats.TopActivity(key, source, group.sumOf { it.seconds.toLong() }, levelIndexOf(level))
            }.sortedWith(compareByDescending<TodayStats.TopActivity> { it.seconds }.thenBy { it.activityKey })
            .take(TOP_ACTIVITIES)

    const val LEVEL_COUNT = 5
    private const val LEVEL_STEP = 25
}
