// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/**
 * One reading of the clocks the exit flow uses: monotonic time
 * (`SystemClock.elapsedRealtime()`) and the boot it belongs to
 * (`Settings.Global.BOOT_COUNT`) measure the wait; wall time only stamps
 * the end.
 */
data class ExitTime(
    val monotonicMs: Long,
    val boot: Int,
    val wallMs: Long,
)
