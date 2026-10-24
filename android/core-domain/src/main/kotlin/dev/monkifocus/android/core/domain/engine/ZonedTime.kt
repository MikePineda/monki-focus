// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import java.time.LocalDate
import java.time.ZoneId
import java.time.zone.ZoneRules

/*
 * Wall-clock time in an IANA zone (SEMANTICS.md §6.3), from `java.time` with
 * the pinned zone only: the device zone is never read. A **wall second**
 * counts seconds since 1970-01-01 00:00 *local* time, so a local date is
 * `floorDiv(wall, 86400)` and wall-clock arithmetic is plain integer
 * arithmetic, which is what makes DST transitions harmless (§6.1). Turning a
 * wall time back into an instant follows the TypeScript engine step by step
 * (offsets around the wall time, then a binary search of a gap) rather than
 * `ZonedDateTime.of`, whose gap and overlap rules differ.
 */

internal const val SECONDS_PER_DAY = 86_400L

/** Monday = 0 … Sunday = 6, the order of `Weekday`. 1970-01-01 was a Thursday. */
private const val EPOCH_DAY_WEEKDAY = 3L

/** The zone ids of the time zone database (a copy is made per call, so it is read once). */
private val availableZoneIds: Set<String> by lazy { ZoneId.getAvailableZoneIds().toSet() }

/** Lower-cased zone id → zone id, for the case-insensitive lookup `Intl` does at run time. */
private val zoneIdsByLowerCase: Map<String, String> by lazy { availableZoneIds.associateBy { it.lowercase() } }

/**
 * True when the time zone database knows the zone under exactly this name
 * (links such as `Asia/Calcutta` included). Validators use it (`x-timeZone`
 * is case-sensitive, SEMANTICS.md §1).
 */
fun isResolvableTimeZone(timeZone: String): Boolean = timeZone in availableZoneIds

/** Thrown for a zone the time zone database cannot resolve; `decide` fails closed on it (§14). */
class UnknownTimeZoneException : IllegalArgumentException("Unknown time zone")

/**
 * The rules of a pinned zone. Like `Intl.DateTimeFormat` in the TypeScript
 * engine, the run-time lookup ignores letter case (validated rule sets carry
 * the exact name anyway); anything else unknown throws.
 */
internal fun zoneRulesOf(timeZone: String): ZoneRules {
    val id = zoneIdsByLowerCase[timeZone.lowercase()] ?: throw UnknownTimeZoneException()
    return ZoneId.of(id).rules
}

/** Throws unless `timeZone` resolves in the time zone database (§14). */
internal fun assertResolvableTimeZone(timeZone: String) {
    zoneRulesOf(timeZone)
}

/** The local wall second of an instant (epoch seconds) in `timeZone`. */
internal fun wallSecondsAt(
    epochSeconds: Long,
    timeZone: String,
): Long = epochSeconds + zoneRulesOf(timeZone).getOffset(java.time.Instant.ofEpochSecond(epochSeconds)).totalSeconds

/** A local wall-clock reading split into its local day and minute. */
internal data class LocalTime(
    /** Days since 1970-01-01 in local time. */
    val dayNumber: Long,
    /** Monday = 0 … Sunday = 6. */
    val weekday: Int,
    /** Whole minutes since local midnight, 0…1439. */
    val minuteOfDay: Int,
    /** `YYYY-MM-DD`. */
    val localDate: String,
)

internal fun localTimeAt(
    epochSeconds: Long,
    timeZone: String,
): LocalTime {
    val wall = wallSecondsAt(epochSeconds, timeZone)
    val dayNumber = Math.floorDiv(wall, SECONDS_PER_DAY)
    return LocalTime(
        dayNumber = dayNumber,
        weekday = weekdayOfDay(dayNumber),
        minuteOfDay = ((wall - dayNumber * SECONDS_PER_DAY) / 60).toInt(),
        localDate = LocalDate.ofEpochDay(dayNumber).toString(),
    )
}

/** Monday = 0 … Sunday = 6 for a local day number (negative day numbers included). */
internal fun weekdayOfDay(dayNumber: Long): Int = Math.floorMod(dayNumber + EPOCH_DAY_WEEKDAY, 7L).toInt()

/**
 * The first instant after `afterEpochSeconds` whose wall clock reads at least
 * `wall` (a wall second later than the wall clock at `after`). A wall time in
 * a spring-forward gap resolves to the first existing instant after the gap;
 * a repeated fall-back time resolves to its first occurrence after `after`.
 */
internal fun firstInstantReachingWall(
    afterEpochSeconds: Long,
    wall: Long,
    timeZone: String,
): Long {
    fun offsetAt(epochSeconds: Long): Long = wallSecondsAt(epochSeconds, timeZone) - epochSeconds

    // Offsets are at most ±18 h, so the zone's offsets around `wall` are those a day either side.
    val offsets = linkedSetOf(offsetAt(wall - SECONDS_PER_DAY), offsetAt(wall), offsetAt(wall + SECONDS_PER_DAY)).toList()
    val exact =
        offsets
            .map { offset -> wall - offset }
            .filter { candidate -> candidate > afterEpochSeconds }
            .filter { candidate -> wallSecondsAt(candidate, timeZone) == wall }
            .minOrNull()
    if (exact != null) return exact
    // The wall time falls in a gap: binary-search the transition that skips it.
    var low = maxOf(afterEpochSeconds, wall - offsets.max() - 1)
    var high = wall - offsets.min()
    while (high - low > 1) {
        val middle = Math.floorDiv(low + high, 2L)
        if (wallSecondsAt(middle, timeZone) >= wall) high = middle else low = middle
    }
    return maxOf(high, afterEpochSeconds + 1)
}

/** Wall seconds of the start of a local day. */
internal fun wallSecondsOfDay(dayNumber: Long): Long = dayNumber * SECONDS_PER_DAY

/** The first instant of the local day after the one `epochSeconds` falls in (§8 step 1). */
internal fun nextLocalMidnight(
    epochSeconds: Long,
    timeZone: String,
): Long {
    val today = localTimeAt(epochSeconds, timeZone).dayNumber
    return firstInstantReachingWall(epochSeconds, wallSecondsOfDay(today + 1), timeZone)
}

/** Whole seconds a zone's wall clock is ahead of UTC at an instant. */
private fun offsetSecondsAt(
    epochSeconds: Long,
    timeZone: String,
): Long = wallSecondsAt(epochSeconds, timeZone) - epochSeconds

/** Zones change their offset at most once an hour (in practice twice a year). */
private const val TRANSITION_PROBE_SECONDS = 3600L

/**
 * Instants in `(from, to]` at which the zone's UTC offset changes (DST
 * transitions): the first second with the new offset. The wall clock is
 * monotonic between two of them, so a wall time is reached at most once per
 * stretch (a fall-back repeats the hour after the transition). Probes hourly
 * and bisects like the TypeScript engine, so both find the same instants.
 */
internal fun offsetTransitionsBetween(
    from: Long,
    to: Long,
    timeZone: String,
): List<Long> {
    val transitions = mutableListOf<Long>()
    var before = from
    var offset = offsetSecondsAt(from, timeZone)
    while (before < to) {
        val probe = minOf(before + TRANSITION_PROBE_SECONDS, to)
        if (offsetSecondsAt(probe, timeZone) != offset) {
            var low = before
            var high = probe
            while (high - low > 1) {
                val middle = Math.floorDiv(low + high, 2L)
                if (offsetSecondsAt(middle, timeZone) == offset) low = middle else high = middle
            }
            transitions += high
            offset = offsetSecondsAt(probe, timeZone)
        }
        before = probe
    }
    return transitions
}
