// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/** Where the system's usage events come from (the platform, or a fake in tests). */
interface UsageEventsSource {
    /**
     * The events the pipeline reads with wall time in `[fromEpochMillis,
     * toEpochMillis)`, oldest first, or [UsageEventsRead.AccessNotGranted]
     * while the user has not granted usage access.
     */
    suspend fun read(
        fromEpochMillis: Long,
        toEpochMillis: Long,
    ): UsageEventsRead
}
