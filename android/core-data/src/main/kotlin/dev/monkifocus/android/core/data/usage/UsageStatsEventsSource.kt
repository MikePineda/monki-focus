// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * [UsageEventsSource] over `UsageStatsManager.queryEvents`. It needs the
 * user-granted usage access (declared and requested by the app, not this
 * module); without it the platform answers no events. Each event is reduced
 * by [UsageEventMapper] right away: only the type, the time and, for
 * activity events, the package name are read.
 */
class UsageStatsEventsSource(
    private val usageStats: UsageStatsManager,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) : UsageEventsSource {
    override suspend fun read(
        fromEpochMillis: Long,
        toEpochMillis: Long,
    ): List<DeviceUsageEvent> =
        withContext(dispatcher) {
            if (fromEpochMillis >= toEpochMillis) return@withContext emptyList()
            val events = usageStats.queryEvents(fromEpochMillis, toEpochMillis) ?: return@withContext emptyList()
            val event = UsageEvents.Event()
            val mapped = mutableListOf<DeviceUsageEvent>()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                UsageEventMapper.toDomain(event.eventType, event.packageName, event.timeStamp)?.let(mapped::add)
            }
            mapped.sortedBy { it.epochMillis }
        }
}
