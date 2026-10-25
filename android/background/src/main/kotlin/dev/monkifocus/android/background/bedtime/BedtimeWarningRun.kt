// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * One run of the bedtime warning worker, without Android: reads the rule set
 * in force, asks [BedtimeWarningSchedule], posts the warning at most once per
 * night (the warned onset is kept as a forward-only cursor) and answers the
 * epoch second to run again at.
 */
class BedtimeWarningRun(
    private val ruleset: suspend (now: String) -> Ruleset?,
    private val cursors: IngestCursorRepository,
    private val notifier: BedtimeWarningNotifier,
) {
    suspend fun run(nowEpochSeconds: Long): Long {
        val rules = ruleset(utcInstantOf(nowEpochSeconds)) ?: return nowEpochSeconds + RETRY_SECONDS
        val lastWarned = cursors.get(WARNED_SOURCE)?.let { Math.floorDiv(it, MILLIS_PER_SECOND) }
        val plan = BedtimeWarningSchedule.plan(rules.bedtime, rules.timeZone, nowEpochSeconds, lastWarned)
        val onset = plan.warningOnset
        if (plan.notify && onset != null) {
            val startsAt = onset + rules.bedtime.warnMinutesBefore * SECONDS_PER_MINUTE
            val minutesLeft =
                Math
                    .floorDiv(
                        startsAt - nowEpochSeconds + SECONDS_PER_MINUTE - 1,
                        SECONDS_PER_MINUTE,
                    ).toInt()
                    .coerceAtLeast(1)
            notifier.warn(minutesLeft)
            cursors.advance(WARNED_SOURCE, onset * MILLIS_PER_SECOND)
        }
        return plan.nextCheckAt
    }

    companion object {
        /** The `ingest_cursor` row holding the onset of the last warning posted (epoch ms). */
        const val WARNED_SOURCE = "bedtime_warned"
        private const val RETRY_SECONDS = 3_600L
        private const val SECONDS_PER_MINUTE = 60L
        private const val MILLIS_PER_SECOND = 1_000L
    }
}
