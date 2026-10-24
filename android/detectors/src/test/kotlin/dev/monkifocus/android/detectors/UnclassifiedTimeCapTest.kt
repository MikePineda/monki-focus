// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UnclassifiedTimeCapTest {
    private val ig = "com.instagram.android"
    private val other = "com.example.other"
    private val second = 1_000L
    private val minute = 60_000L

    /** Observes [pkg] every 30 s from [fromMs] to [toMs] (the service ticks at least every minute). */
    private fun UnclassifiedTimeCap.use(
        pkg: String,
        classified: Boolean,
        fromMs: Long,
        toMs: Long,
    ): UnclassifiedTimeCap {
        var state = this
        var t = fromMs
        while (t <= toMs) {
            state = state.observe(pkg, classified, t)
            t += 30 * second
        }
        return state
    }

    private fun UnclassifiedTimeCap.frictionAt(
        nowMs: Long,
        cap: Int = 10,
        blockRule: Boolean = true,
    ): Boolean = frictionApplies(ig, capMinutes = cap, packageHasSurfaceBlockRule = blockRule, nowMonotonicMs = nowMs)

    @Test
    fun friction_after_cap_minutes_unclassified() {
        val state = UnclassifiedTimeCap.INITIAL.use(ig, classified = false, fromMs = 0, toMs = 10 * minute)

        assertFalse(state.frictionAt(9 * minute + 30 * second))
        assertTrue(state.frictionAt(10 * minute))
    }

    @Test
    fun short_classified_blips_do_not_reset_the_count() {
        var state = UnclassifiedTimeCap.INITIAL
        // Nine minutes unclassified, broken every three minutes by a 30 s classified blip.
        for (block in 0 until 3) {
            val start = block * 3 * minute + block * 30 * second
            state = state.use(ig, classified = false, fromMs = start, toMs = start + 3 * minute)
            state = state.observe(ig, classified = true, nowMonotonicMs = start + 3 * minute + 15 * second)
        }
        val resume = 9 * minute + 3 * 30 * second
        state = state.use(ig, classified = false, fromMs = resume, toMs = resume + minute)

        assertTrue(state.frictionAt(resume + minute))
    }

    @Test
    fun quick_app_switches_do_not_reset_the_count() {
        val state =
            UnclassifiedTimeCap.INITIAL
                .use(ig, classified = false, fromMs = 0, toMs = 6 * minute)
                .use(other, classified = false, fromMs = 6 * minute + 10 * second, toMs = 6 * minute + 40 * second)
                .use(ig, classified = false, fromMs = 7 * minute, toMs = 11 * minute)

        assertTrue(state.frictionAt(11 * minute))
    }

    @Test
    fun time_outside_the_two_cap_window_does_not_count() {
        val state =
            UnclassifiedTimeCap.INITIAL
                .use(ig, classified = false, fromMs = 0, toMs = 6 * minute)
                .use(ig, classified = true, fromMs = 6 * minute + 30 * second, toMs = 30 * minute)
                .use(ig, classified = false, fromMs = 30 * minute + 30 * second, toMs = 35 * minute)

        assertFalse(state.frictionAt(35 * minute))
    }

    @Test
    fun a_classified_screen_now_gets_no_friction() {
        val state =
            UnclassifiedTimeCap.INITIAL
                .use(ig, classified = false, fromMs = 0, toMs = 12 * minute)
                .observe(ig, classified = true, nowMonotonicMs = 12 * minute + 10 * second)

        assertFalse(state.frictionAt(12 * minute + 10 * second))
    }

    @Test
    fun a_screen_off_gap_is_not_counted() {
        val state =
            UnclassifiedTimeCap.INITIAL
                .use(ig, classified = false, fromMs = 0, toMs = 2 * minute)
                .backgrounded(2 * minute + 10 * second)
                .observe(ig, classified = false, nowMonotonicMs = 40 * minute)

        assertFalse(state.frictionAt(40 * minute))
    }

    @Test
    fun a_missed_event_counts_at_most_one_minute() {
        val state =
            UnclassifiedTimeCap.INITIAL
                .observe(ig, classified = false, nowMonotonicMs = 0)
                .observe(ig, classified = false, nowMonotonicMs = 30 * minute)

        assertFalse(state.frictionAt(30 * minute))
    }

    @Test
    fun cap_zero_is_off_and_no_block_rule_means_no_safety_net() {
        val state = UnclassifiedTimeCap.INITIAL.use(ig, classified = false, fromMs = 0, toMs = 60 * minute)

        assertFalse(state.frictionAt(60 * minute, cap = 0))
        assertFalse(state.frictionAt(60 * minute, blockRule = false))
    }
}
