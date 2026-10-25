// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.fakes

import dev.monkifocus.android.core.data.usage.UsageEventsRead
import dev.monkifocus.android.core.data.usage.UsageEventsSource
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent

/** The system's usage events as a list; [granted] stands for the usage-access switch. */
class FakeUsageEventsSource(
    var events: List<DeviceUsageEvent> = emptyList(),
    var granted: Boolean = true,
) : UsageEventsSource {
    override suspend fun read(
        fromEpochMillis: Long,
        toEpochMillis: Long,
    ): UsageEventsRead =
        if (!granted) {
            UsageEventsRead.AccessNotGranted
        } else {
            UsageEventsRead.Events(events.filter { it.epochMillis in fromEpochMillis until toEpochMillis }.sortedBy { it.epochMillis })
        }
}
