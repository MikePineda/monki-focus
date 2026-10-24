// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [UsageEventsSource] over `UsageStatsManager.queryEvents`. It checks the
 * user's usage-access grant before every query and answers
 * [UsageEventsRead.AccessNotGranted] without one. Each event is reduced by
 * [UsageEventMapper] right away: only the type, the time and, for activity
 * events, the package name are read.
 */
class UsageStatsEventsSource(
    private val usageStats: UsageStatsManager,
    private val access: UsageAccess,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) : UsageEventsSource {
    override suspend fun read(
        fromEpochMillis: Long,
        toEpochMillis: Long,
    ): UsageEventsRead =
        withContext(dispatcher) {
            if (!access.isGranted()) return@withContext UsageEventsRead.AccessNotGranted
            if (fromEpochMillis >= toEpochMillis) return@withContext UsageEventsRead.Events(emptyList())
            val events =
                try {
                    usageStats.queryEvents(fromEpochMillis, toEpochMillis)
                } catch (_: SecurityException) {
                    // Revoked between the check and the query.
                    return@withContext UsageEventsRead.AccessNotGranted
                } ?: return@withContext UsageEventsRead.Events(emptyList())
            val event = UsageEvents.Event()
            val mapped = mutableListOf<DeviceUsageEvent>()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                UsageEventMapper.toDomain(event.eventType, event.packageName, event.timeStamp)?.let(mapped::add)
            }
            UsageEventsRead.Events(mapped.sortedBy { it.epochMillis })
        }
}
