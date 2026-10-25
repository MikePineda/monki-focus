// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.PulseInput
import dev.monkifocus.android.core.domain.analytics.pulse
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import kotlin.math.roundToLong

/**
 * The extension's `WeekStatsQuery` on Android: the pulse of each of the last
 * seven local days and, over the last [HOURLY_WEEKS] weeks, the average
 * tracked seconds and the pulse per weekday and local hour. Pure.
 */
object WeekStatsQuery {
    const val WEEK_DAYS = 7
    const val HOURLY_WEEKS = 4
    private const val HOURS = 24

    /** How far back callers read: the hourly window plus one spare day for the zone offset. */
    const val LOOKBACK_SECONDS = (HOURLY_WEEKS * WEEK_DAYS + 1) * 86_400L

    fun compute(
        blocks: List<ActivityBlock>,
        nowEpochSeconds: Long,
        timeZone: String,
    ): WeekStats {
        val calendar = LocalCalendar(timeZone)
        val today = calendar.at(nowEpochSeconds).dayNumber
        val firstHourlyDay = today - HOURLY_WEEKS * WEEK_DAYS + 1
        val byDay = HashMap<Long, MutableList<ActivityBlock>>()
        val byCell = HashMap<Int, MutableList<ActivityBlock>>()
        for (block in blocks) {
            val local = calendar.at(epochSecondsOf(block.blockStart))
            if (local.dayNumber < firstHourlyDay || local.dayNumber > today) continue
            byDay.getOrPut(local.dayNumber) { mutableListOf() } += block
            byCell.getOrPut(local.weekday * HOURS + local.hour) { mutableListOf() } += block
        }
        val days =
            (today - WEEK_DAYS + 1..today).map { day ->
                val group = byDay[day].orEmpty()
                WeekStats.DailyPulse(
                    date = LocalCalendar.dateOf(day),
                    weekday = LocalCalendar.weekdayOf(day),
                    pulse = pulseOf(group),
                    totalSeconds = group.sumOf { it.seconds.toLong() },
                )
            }
        val hourly =
            (0 until WEEK_DAYS).flatMap { weekday ->
                (0 until HOURS).map { hour ->
                    val group = byCell[weekday * HOURS + hour].orEmpty()
                    WeekStats.HourlyCell(
                        weekday = weekday,
                        hour = hour,
                        averageSeconds = (group.sumOf { it.seconds.toLong() }.toDouble() / HOURLY_WEEKS).roundToLong(),
                        pulse = pulseOf(group),
                    )
                }
            }
        return WeekStats(days = days, weeks = HOURLY_WEEKS, hourly = hourly)
    }

    private fun pulseOf(blocks: List<ActivityBlock>): Int? = pulse(blocks.map { PulseInput(it.seconds.toLong(), it.level) })
}
