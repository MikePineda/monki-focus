// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

/**
 * One app in the foreground during `[startMillis, endMillis)` (epoch
 * milliseconds). [open] marks a session still running when the batch ended:
 * its end is the batch end and the next ingest extends it in place.
 */
data class ForegroundSession(
    val packageName: String,
    val startMillis: Long,
    val endMillis: Long,
    val open: Boolean = false,
)
