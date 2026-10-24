// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent

/** Where the system's usage events come from (the platform, or a fake in tests). */
interface UsageEventsSource {
    /**
     * The events the pipeline reads with wall time in `[fromEpochMillis,
     * toEpochMillis)`, oldest first. Empty without usage access.
     */
    suspend fun read(
        fromEpochMillis: Long,
        toEpochMillis: Long,
    ): List<DeviceUsageEvent>
}
