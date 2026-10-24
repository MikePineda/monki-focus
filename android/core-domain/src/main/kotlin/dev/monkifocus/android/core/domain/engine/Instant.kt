// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import java.time.DateTimeException
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/*
 * Instants (SEMANTICS.md §1). Inputs MUST be RFC 3339 with an explicit offset
 * or `Z` and whole seconds (the schema pattern); a floating local time or any
 * other text is invalid input and throws, which `decide` turns into a
 * fail-closed decision (§14). Parsing is strict on purpose: `java.time`
 * parsers accept more (fractions, offsets without a colon, lower-case `z`).
 * Every computed instant is written in UTC with `Z` and no fractional
 * seconds, so fixtures compare as strings. The engine works in whole epoch
 * seconds internally.
 */

private val RFC_3339_INSTANT =
    Regex("""^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):(\d{2}))$""")

private val UTC_INSTANT_FORMAT: DateTimeFormatter =
    DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC)

/** Thrown for text that is not an RFC 3339 instant with an explicit offset and whole seconds. */
class InvalidInstantException : IllegalArgumentException("Not an RFC 3339 instant with an explicit offset")

/** Whole seconds since the Unix epoch of an RFC 3339 instant with an explicit offset. */
fun epochSecondsOf(instant: String): Long {
    val fields = RFC_3339_INSTANT.matchEntire(instant)?.groupValues ?: throw InvalidInstantException()
    val (year, month, day, hour, minute, second) = fields.subList(1, 7).map { it.toInt() }
    val offsetSign = if (fields[7] == "-") -1 else 1
    val offsetHours = fields[8].ifEmpty { "0" }.toInt()
    val offsetMinutes = fields[9].ifEmpty { "0" }.toInt()
    if (hour > 23 || minute > 59 || second > 59 || offsetHours > 23 || offsetMinutes > 59) {
        throw InvalidInstantException()
    }
    // Rejects month 13, 31 April and the like instead of rolling them over.
    val date =
        try {
            LocalDate.of(year, month, day)
        } catch (_: DateTimeException) {
            throw InvalidInstantException()
        }
    val wallSeconds = date.toEpochDay() * SECONDS_PER_DAY + hour * 3600L + minute * 60L + second
    return wallSeconds - offsetSign * (offsetHours * 3600L + offsetMinutes * 60L)
}

/**
 * The `now` adapters pass to the engine: `instantOf(clock.millis())`. Floors
 * to whole seconds (text with fractions is invalid input and would fail
 * closed). A negative value is an adapter bug and throws.
 */
fun instantOf(epochMillis: Long): String {
    require(epochMillis >= 0) { "epochMillis must be non-negative" }
    return utcInstantOf(Math.floorDiv(epochMillis, 1000L))
}

/** The canonical UTC form (`2026-10-25T23:00:00Z`) of whole epoch seconds. */
fun utcInstantOf(epochSeconds: Long): String = UTC_INSTANT_FORMAT.format(java.time.Instant.ofEpochSecond(epochSeconds))

private operator fun <T> List<T>.component6(): T = this[5]
