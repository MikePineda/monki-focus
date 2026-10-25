// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.AfkStatus

/**
 * A stretch `[startMillis, endMillis)` (epoch milliseconds) during which the
 * user was away (screen off or locked) or not. [open] marks the period still
 * running when the batch ended.
 */
data class AfkPeriod(
    val status: AfkStatus,
    val startMillis: Long,
    val endMillis: Long,
    val open: Boolean = false,
)
