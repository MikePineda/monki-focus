// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

import dev.monkifocus.android.core.domain.engine.BedtimePhase
import dev.monkifocus.android.core.domain.engine.bedtimePhase
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.Bedtime

/**
 * The bedtime warning fallback (plan §2.7): the engine's `bedtimePhase`
 * decides, in the rule set's pinned zone, whether this instant is in the
 * `warnMinutesBefore` lead-up of a bedtime start. Pure.
 *
 * - In a warning that was not announced yet: notify, keyed by the minute the
 *   warning began, so a second run in the same lead-up stays quiet.
 * - A run that lands late, inside bedtime itself, warns no more.
 * - The next check is the start of the next warning (found minute by minute,
 *   at most [HORIZON_SECONDS] ahead); a disabled bedtime, no lead-up or no
 *   warning in the horizon checks again a day later, so rule changes are
 *   picked up without an exact alarm.
 */
object BedtimeWarningSchedule {
    fun plan(
        bedtime: Bedtime,
        timeZone: String,
        nowEpochSeconds: Long,
        lastWarnedOnset: Long?,
    ): BedtimeWarningPlan {
        val recheck = nowEpochSeconds + RECHECK_SECONDS
        if (!bedtime.enabled || bedtime.warnMinutesBefore <= 0) return BedtimeWarningPlan(false, null, recheck)

        fun phaseAt(epochSeconds: Long) = bedtimePhase(bedtime, utcInstantOf(epochSeconds), timeZone)

        val onset =
            if (phaseAt(nowEpochSeconds) == BedtimePhase.WARNING) {
                var start = Math.floorDiv(nowEpochSeconds, MINUTE) * MINUTE
                repeat(bedtime.warnMinutesBefore + 1) { if (phaseAt(start - MINUTE) == BedtimePhase.WARNING) start -= MINUTE }
                start
            } else {
                null
            }
        var next: Long? = null
        var minute = Math.floorDiv(nowEpochSeconds, MINUTE) * MINUTE + MINUTE
        var previous = phaseAt(minute - MINUTE)
        while (minute <= nowEpochSeconds + HORIZON_SECONDS) {
            val phase = phaseAt(minute)
            if (phase == BedtimePhase.WARNING && previous != BedtimePhase.WARNING) {
                next = minute
                break
            }
            previous = phase
            minute += MINUTE
        }
        return BedtimeWarningPlan(
            notify = onset != null && onset != lastWarnedOnset,
            warningOnset = onset,
            nextCheckAt = next ?: recheck,
        )
    }

    private const val MINUTE = 60L
    private const val RECHECK_SECONDS = 86_400L

    /** A week and a day: every weekly bedtime has a lead-up in it. */
    private const val HORIZON_SECONDS = 8 * 86_400L
}
