// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReadThrottleTest {
    private val throttle = ReadThrottle()

    private fun content(
        at: Long,
        pkg: String = "com.example.app",
    ) = WindowEvent(WindowEventType.CONTENT_CHANGED, pkg, at)

    private fun state(
        at: Long,
        pkg: String = "com.example.app",
    ) = WindowEvent(WindowEventType.STATE_CHANGED, pkg, at)

    @Test
    fun a_content_burst_is_read_once_per_interval() {
        val admitted = (0L until 1_000L step 50).count { throttle.admit(content(1_000 + it)) }

        assertEquals("one read per 250 ms over one second", 4, admitted)
    }

    @Test
    fun window_state_changes_are_always_read() {
        assertTrue(throttle.admit(content(1_000)))

        assertTrue(throttle.admit(state(1_010)))
        assertTrue(throttle.admit(state(1_020)))
    }

    @Test
    fun a_change_of_package_is_read_at_once() {
        assertTrue(throttle.admit(content(1_000, "com.example.one")))

        assertTrue(throttle.admit(content(1_010, "com.example.two")))
    }

    @Test
    fun the_last_screen_of_a_burst_is_flushed_once_the_interval_is_over() {
        throttle.admit(content(1_000))
        assertFalse(throttle.admit(content(1_100)))
        assertEquals(150L, throttle.flushDelayMs(1_100))

        assertNull("too early", throttle.flush(1_200))
        assertEquals("com.example.app", throttle.flush(1_250)?.packageName)
        assertNull("flushed once", throttle.flush(1_600))
        assertNull(throttle.flushDelayMs(1_600))
    }
}
