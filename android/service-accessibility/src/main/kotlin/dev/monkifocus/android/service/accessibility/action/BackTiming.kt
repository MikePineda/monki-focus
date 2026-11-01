// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/**
 * When `GLOBAL_ACTION_BACK` may fire after one of our screens that held
 * input focus was taken down ("Go back" from a prompt in a focusable
 * overlay or from `GateActivity`). BACK goes to the focused window, so
 * fired at once it would reach our closing screen (in the activity, its
 * back callback) instead of the browser. It waits while `GateActivity` is
 * still visible and briefly after a focusable overlay is removed, never
 * longer than [MAX_WAIT_MS]. Screens that never take focus BACK at once.
 */
object BackTiming {
    const val STEP_MS = 50L
    const val FOCUS_SETTLE_MS = 100L
    const val MAX_WAIT_MS = 1_000L

    /** How long to wait before the next look, or null to fire BACK now. */
    fun delayMs(
        ourWindowHeldFocus: Boolean,
        activityVisible: Boolean,
        waitedMs: Long,
    ): Long? =
        when {
            waitedMs >= MAX_WAIT_MS -> null
            activityVisible -> STEP_MS
            ourWindowHeldFocus && waitedMs == 0L -> FOCUS_SETTLE_MS
            else -> null
        }
}
