// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.BlockRepository
import dev.monkifocus.android.core.domain.ports.IntentionRepository

/**
 * Reads the local blocks and the gate's intentions through the domain ports
 * and decides what the screen shows. Without usage access and without any
 * recorded time the screen explains the missing permission; with access but
 * no time yet it says data comes after the first ingest.
 */
class StatsLoader(
    private val blocks: BlockRepository,
    /** The gate's intention log; without one the intentions are zeros. */
    private val intentions: IntentionRepository?,
    private val usageAccessGranted: () -> Boolean,
    /** The rule set's pinned zone at an instant. */
    private val timeZone: suspend (now: String) -> String,
) {
    suspend fun load(nowEpochMillis: Long): StatsScreenState {
        val nowSeconds = Math.floorDiv(nowEpochMillis, MILLIS_PER_SECOND)
        val now = utcInstantOf(nowSeconds)
        val zone = timeZone(now)
        val until = utcInstantOf(nowSeconds + 1)
        val recent = blocks.between(utcInstantOf(nowSeconds - WeekStatsQuery.LOOKBACK_SECONDS), until)
        val started = intentions?.startedBetween(utcInstantOf(nowSeconds - TodayStatsQuery.LOOKBACK_SECONDS), until).orEmpty()
        val today = TodayStatsQuery.compute(recent, started, nowSeconds, zone)
        val week = WeekStatsQuery.compute(recent, nowSeconds, zone)
        val access = usageAccessGranted()
        return when {
            !week.empty || today.intentions.total > 0 -> StatsScreenState.Ready(today, week, usageAccessMissing = !access)
            !access -> StatsScreenState.NoUsageAccess
            else -> StatsScreenState.NoDataYet
        }
    }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L
    }
}
