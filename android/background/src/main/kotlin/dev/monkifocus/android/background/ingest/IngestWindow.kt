// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.data.usage.UsageEventsCopy

/**
 * The window one usage copy reads, the same rule [UsageEventsCopy] applies
 * with these values: from the previous cursor minus [OVERLAP_MILLIS], or
 * [FIRST_LOOKBACK_MILLIS] back on the first copy, up to now. The ingest sink
 * needs its start to carry what was in effect there.
 */
object IngestWindow {
    const val OVERLAP_MILLIS: Long = UsageEventsCopy.FIVE_MINUTES
    const val FIRST_LOOKBACK_MILLIS: Long = UsageEventsCopy.SEVEN_DAYS

    fun fromMillis(
        previousCursor: Long?,
        nowMillis: Long,
    ): Long = maxOf(0L, if (previousCursor == null) nowMillis - FIRST_LOOKBACK_MILLIS else previousCursor - OVERLAP_MILLIS)
}
