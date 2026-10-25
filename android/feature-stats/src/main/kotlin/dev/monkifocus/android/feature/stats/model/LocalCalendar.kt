// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import java.time.DateTimeException
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * Local calendar facts in the rule set's pinned zone (never the device
 * zone). A 5-minute block never straddles a local hour, because every zone in
 * use has an offset that is a multiple of five minutes. An unresolvable zone
 * (impossible for a validated rule set) falls back to UTC rather than failing.
 */
class LocalCalendar(
    timeZone: String,
) {
    private val zone: ZoneId =
        try {
            ZoneId.of(timeZone)
        } catch (_: DateTimeException) {
            ZoneOffset.UTC
        }

    /** A local reading: day number since 1970-01-01, Monday = 0 weekday, hour 0..23. */
    data class Reading(
        val dayNumber: Long,
        val weekday: Int,
        val hour: Int,
    ) {
        val date: String get() = dateOf(dayNumber)
    }

    fun at(epochSeconds: Long): Reading {
        val local = Instant.ofEpochSecond(epochSeconds).atZone(zone)
        return Reading(local.toLocalDate().toEpochDay(), local.dayOfWeek.value - 1, local.hour)
    }

    companion object {
        /** `YYYY-MM-DD` of a local day number. */
        fun dateOf(dayNumber: Long): String = LocalDate.ofEpochDay(dayNumber).toString()

        /** Monday = 0 … Sunday = 6 of a local day number. */
        fun weekdayOf(dayNumber: Long): Int = LocalDate.ofEpochDay(dayNumber).dayOfWeek.value - 1
    }
}
