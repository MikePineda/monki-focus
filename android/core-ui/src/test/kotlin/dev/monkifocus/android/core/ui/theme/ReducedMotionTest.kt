// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.theme

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReducedMotionTest {
    @Test
    fun animator_scale_zero_means_reduced_motion() {
        assertTrue(isReducedMotion(0f))
    }

    @Test
    fun any_other_animator_scale_keeps_motion() {
        assertFalse(isReducedMotion(1f))
        assertFalse(isReducedMotion(0.5f))
        assertFalse(isReducedMotion(10f))
    }
}
