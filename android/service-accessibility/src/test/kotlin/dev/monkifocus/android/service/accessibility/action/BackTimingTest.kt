// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** "Go back" BACKs into the browser, not into our closing screen. */
class BackTimingTest {
    @Test
    fun a_screen_that_never_took_focus_backs_at_once() {
        assertNull(BackTiming.delayMs(ourWindowHeldFocus = false, activityVisible = false, waitedMs = 0))
    }

    @Test
    fun back_waits_while_the_gate_activity_is_still_visible() {
        assertEquals(BackTiming.STEP_MS, BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = true, waitedMs = 0))
        assertEquals(BackTiming.STEP_MS, BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = true, waitedMs = 500))
        assertNull(BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = false, waitedMs = 550))
    }

    @Test
    fun back_lets_the_focus_settle_once_after_a_focusable_overlay() {
        assertEquals(BackTiming.FOCUS_SETTLE_MS, BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = false, waitedMs = 0))
        assertNull(BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = false, waitedMs = BackTiming.FOCUS_SETTLE_MS))
    }

    @Test
    fun back_never_waits_longer_than_a_second() {
        assertNull(BackTiming.delayMs(ourWindowHeldFocus = true, activityVisible = true, waitedMs = BackTiming.MAX_WAIT_MS))
    }
}
