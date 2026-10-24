// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.Bedtime

/*
 * Bedtime (SEMANTICS.md §6.2): `active` inside the nightly window, `warning`
 * during the `warnMinutesBefore` minutes before a listed start, otherwise
 * `inactive`. In `decide` bedtime blocks targets of category level ≤ 25
 * (§5.2.1) and is active when it is active in any pinned zone (§6.3).
 */

enum class BedtimePhase(
    /** The wire name used by the `schedule` fixtures. */
    val code: String,
) {
    INACTIVE("inactive"),
    WARNING("warning"),
    ACTIVE("active"),
}

/** Highest category level bedtime blocks. */
internal const val BEDTIME_MAX_LEVEL = 25

/** The escalation group of emergency overrides requested from the bedtime screen. */
const val BEDTIME_GROUP = "bedtime"

internal fun bedtimePhaseAt(
    bedtime: Bedtime,
    epochSeconds: Long,
    timeZone: String,
): BedtimePhase {
    if (!bedtime.enabled) return BedtimePhase.INACTIVE
    val local = localTimeAt(epochSeconds, timeZone)
    if (occurrenceAt(bedtime, local) != null) return BedtimePhase.ACTIVE
    return if (isInLeadUp(bedtime, local, bedtime.warnMinutesBefore)) BedtimePhase.WARNING else BedtimePhase.INACTIVE
}

fun bedtimePhase(
    bedtime: Bedtime,
    now: String,
    timeZone: String,
): BedtimePhase = bedtimePhaseAt(bedtime, epochSecondsOf(now), timeZone)

/** Bedtime is active when it is active in any of the pinned zones (§6.3). */
internal fun isBedtimeActive(
    bedtime: Bedtime,
    epochSeconds: Long,
    zones: List<String>,
): Boolean = zones.any { zone -> bedtimePhaseAt(bedtime, epochSeconds, zone) == BedtimePhase.ACTIVE }
