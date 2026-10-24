// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/**
 * The usage copy job contract. The system keeps usage events for a few days
 * only, so a worker (scheduled by the background work package, at least
 * daily and when the app opens) calls [run] to copy everything since the last
 * cursor into the app's own store before the system drops it. [run] is
 * idempotent and safe to retry: the cursor only advances after the sink
 * accepted the events.
 */
interface UsageCopyJob {
    suspend fun run(nowEpochMillis: Long): UsageCopyResult
}
