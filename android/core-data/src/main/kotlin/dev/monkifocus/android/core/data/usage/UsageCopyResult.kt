// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/**
 * What one copy read: the window `[fromEpochMillis, toEpochMillis)`, how many
 * events, the stored cursor, and whether usage access was granted (without
 * it nothing is read and the cursor stays).
 */
data class UsageCopyResult(
    val fromEpochMillis: Long,
    val toEpochMillis: Long,
    val eventCount: Int,
    val cursorEpochMillis: Long?,
    val accessGranted: Boolean = true,
)
