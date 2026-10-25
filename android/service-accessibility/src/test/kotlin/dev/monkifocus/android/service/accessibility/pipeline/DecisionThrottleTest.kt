// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DecisionThrottleTest {
    private val throttle = DecisionThrottle()
    private val reels = ObservationKey.App("com.instagram.android", "instagram.reels")
    private val direct = ObservationKey.App("com.instagram.android", "instagram.direct")

    @Test
    fun the_same_target_is_decided_at_most_once_per_second() {
        assertTrue(throttle.admit(reels, 1_000))

        assertFalse(throttle.admit(reels, 1_500))
        assertTrue(throttle.admit(reels, 2_000))
    }

    @Test
    fun a_change_of_surface_is_decided_at_once() {
        throttle.admit(reels, 1_000)

        assertTrue(throttle.admit(direct, 1_010))
    }

    @Test
    fun the_unclassified_cap_turning_on_is_a_new_target() {
        val unclassified = ObservationKey.App("com.google.android.youtube", null)
        throttle.admit(unclassified, 1_000)

        assertTrue(throttle.admit(unclassified.copy(capped = true), 1_010))
    }

    @Test
    fun invalidate_lets_the_next_observation_through() {
        throttle.admit(reels, 1_000)

        throttle.invalidate()

        assertTrue(throttle.admit(reels, 1_010))
    }
}
