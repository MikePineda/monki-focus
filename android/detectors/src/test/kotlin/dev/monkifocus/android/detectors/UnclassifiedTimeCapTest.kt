// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UnclassifiedTimeCapTest {
    private val ig = "com.instagram.android"
    private val minute = 60_000L

    private fun unclassifiedFor(minutes: Long): UnclassifiedTimeCap =
        UnclassifiedTimeCap.INITIAL
            .observe(ig, classified = false, nowMonotonicMs = 0)
            .observe(ig, classified = false, nowMonotonicMs = minutes * minute)

    private fun UnclassifiedTimeCap.frictionAt(
        minutes: Long,
        cap: Int = 10,
        blockRule: Boolean = true,
    ): Boolean = frictionApplies(ig, capMinutes = cap, packageHasSurfaceBlockRule = blockRule, nowMonotonicMs = minutes * minute)

    @Test
    fun unclassified_package_with_a_surface_block_rule_gets_friction_after_the_cap() {
        assertFalse(unclassifiedFor(10).frictionAt(10))
        assertTrue(unclassifiedFor(11).frictionAt(11))
    }

    @Test
    fun recognising_a_surface_restarts_the_count() {
        val state =
            unclassifiedFor(9)
                .observe(ig, classified = true, nowMonotonicMs = 9 * minute)
                .observe(ig, classified = false, nowMonotonicMs = 10 * minute)

        assertFalse(state.frictionAt(15))
        assertTrue(state.frictionAt(21))
    }

    @Test
    fun leaving_the_package_restarts_the_count() {
        val state =
            unclassifiedFor(9)
                .observe("com.example.other", classified = false, nowMonotonicMs = 9 * minute)
                .observe(ig, classified = false, nowMonotonicMs = 10 * minute)

        assertFalse(state.frictionAt(19))
    }

    @Test
    fun cap_zero_is_off() {
        assertFalse(unclassifiedFor(500).frictionAt(500, cap = 0))
    }

    @Test
    fun no_surface_block_rule_means_no_safety_net() {
        assertFalse(unclassifiedFor(60).frictionAt(60, blockRule = false))
    }

    @Test
    fun a_monotonic_clock_reset_restarts_the_count() {
        val state = unclassifiedFor(9).observe(ig, classified = false, nowMonotonicMs = 1_000)

        assertFalse(state.frictionAt(5))
    }
}
