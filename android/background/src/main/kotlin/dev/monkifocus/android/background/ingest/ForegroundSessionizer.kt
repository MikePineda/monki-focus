// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind

/**
 * Turns system usage events into non-overlapping foreground sessions (plan
 * §2.10). Pure. One app is in front at a time:
 *
 * - `ACTIVITY_RESUMED` of an app ends the current session (if another app's)
 *   and opens one for it; a repeated resume of the same app changes nothing;
 * - `ACTIVITY_PAUSED` ends the session of that app only (a pause that arrives
 *   after the next app resumed is ignored);
 * - the screen turning off, the keyguard showing and a shutdown end the
 *   current session; the screen turning on opens nothing by itself.
 *
 * Only events in `[fromMillis, toMillis)` count. A [carried] session (the
 * stored one in effect at `fromMillis`) continues from its own start, so a
 * re-ingest of an overlap rebuilds the same sessions. A session still in front
 * at `toMillis` ends there and is marked open. Zero-length sessions are dropped.
 */
object ForegroundSessionizer {
    fun sessionize(
        events: List<DeviceUsageEvent>,
        fromMillis: Long,
        toMillis: Long,
        carried: ForegroundSession? = null,
    ): List<ForegroundSession> {
        val sessions = mutableListOf<ForegroundSession>()
        var current: Pair<String, Long>? = carried?.let { it.packageName to it.startMillis }

        fun close(at: Long) {
            val (pkg, start) = current ?: return
            if (at > start) sessions += ForegroundSession(pkg, start, at)
            current = null
        }

        for (event in events.sortedBy { it.epochMillis }) {
            val at = event.epochMillis
            if (at < fromMillis || at >= toMillis) continue
            when (event.kind) {
                UsageEventKind.ACTIVITY_RESUMED -> {
                    val pkg = requireNotNull(event.packageName)
                    if (current?.first != pkg) {
                        close(at)
                        current = pkg to at
                    }
                }

                UsageEventKind.ACTIVITY_PAUSED -> {
                    if (current?.first == event.packageName) close(at)
                }

                UsageEventKind.SCREEN_NON_INTERACTIVE, UsageEventKind.KEYGUARD_SHOWN, UsageEventKind.DEVICE_SHUTDOWN -> {
                    close(at)
                }

                // The screen turning on opens nothing by itself.
                UsageEventKind.SCREEN_INTERACTIVE, UsageEventKind.KEYGUARD_HIDDEN -> {}
            }
        }
        current?.let { (pkg, start) -> if (toMillis > start) sessions += ForegroundSession(pkg, start, toMillis, open = true) }
        return sessions
    }
}
