// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent

/**
 * Where copied usage events go (WP 2.8: the sessionizer and AFK filter that
 * turn them into idempotent `aw_event` rows). It must tolerate seeing the
 * same events again: every copy re-reads an overlap before the cursor.
 */
fun interface UsageEventsSink {
    suspend fun accept(events: List<DeviceUsageEvent>)
}
