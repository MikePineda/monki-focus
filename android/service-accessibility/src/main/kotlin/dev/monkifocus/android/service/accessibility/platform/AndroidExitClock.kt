// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import dev.monkifocus.android.service.accessibility.exit.ExitClock
import dev.monkifocus.android.service.accessibility.exit.ExitTime

/**
 * The exit flow's clocks on the device: `elapsedRealtime` (monotonic, counts
 * deep sleep, restarts at boot), the boot count of `Settings.Global` (0 when
 * it cannot be read: a reboot is then still caught by the monotonic reading
 * going backwards) and the wall clock for the end stamp only.
 */
internal class AndroidExitClock(
    context: Context,
) : ExitClock {
    private val resolver = context.applicationContext.contentResolver

    override fun now(): ExitTime =
        ExitTime(
            monotonicMs = SystemClock.elapsedRealtime(),
            boot = runCatching { Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT) }.getOrDefault(0),
            wallMs = System.currentTimeMillis(),
        )
}
