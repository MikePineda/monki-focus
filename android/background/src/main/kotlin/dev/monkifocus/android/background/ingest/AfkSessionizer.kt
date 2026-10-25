// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.AfkStatus
import dev.monkifocus.android.core.domain.usage.DeviceUsageEvent
import dev.monkifocus.android.core.domain.usage.UsageEventKind

/**
 * The `afkstatus` periods of a batch of system usage events (plan §2.10).
 * Pure. The user is away while the screen is off or the keyguard shows (the
 * lock screen is not use): `SCREEN_NON_INTERACTIVE` and `DEVICE_SHUTDOWN`
 * turn the screen off, `SCREEN_INTERACTIVE` on; `KEYGUARD_SHOWN` /
 * `KEYGUARD_HIDDEN` lock and unlock. App events change nothing.
 *
 * The batch starts present unless a [carried] period (the stored one in
 * effect at `fromMillis`) says otherwise; that period continues from its own
 * start, so a re-ingest rebuilds the same rows. A carried away period does not
 * know whether the screen was off or locked: the next screen-on ends it. The
 * last period ends at `toMillis` and is marked open.
 */
object AfkSessionizer {
    fun periods(
        events: List<DeviceUsageEvent>,
        fromMillis: Long,
        toMillis: Long,
        carried: AfkPeriod? = null,
    ): List<AfkPeriod> {
        val periods = mutableListOf<AfkPeriod>()
        var screenOn = carried?.status != AfkStatus.AFK
        var locked = false
        var status = carried?.status ?: AfkStatus.NOT_AFK
        var since = carried?.startMillis ?: fromMillis

        for (event in events.sortedBy { it.epochMillis }) {
            val at = event.epochMillis
            if (at < fromMillis || at >= toMillis) continue
            when (event.kind) {
                UsageEventKind.SCREEN_INTERACTIVE -> screenOn = true
                UsageEventKind.SCREEN_NON_INTERACTIVE, UsageEventKind.DEVICE_SHUTDOWN -> screenOn = false
                UsageEventKind.KEYGUARD_SHOWN -> locked = true
                UsageEventKind.KEYGUARD_HIDDEN -> locked = false
                UsageEventKind.ACTIVITY_RESUMED, UsageEventKind.ACTIVITY_PAUSED -> continue
            }
            val next = if (!screenOn || locked) AfkStatus.AFK else AfkStatus.NOT_AFK
            if (next != status) {
                if (at > since) periods += AfkPeriod(status, since, at)
                status = next
                since = at
            }
        }
        if (toMillis > since) periods += AfkPeriod(status, since, toMillis, open = true)
        return periods
    }
}
