// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/** What one copy read: the window `[fromEpochMillis, toEpochMillis)`, how many events, and the stored cursor. */
data class UsageCopyResult(
    val fromEpochMillis: Long,
    val toEpochMillis: Long,
    val eventCount: Int,
    val cursorEpochMillis: Long?,
)
