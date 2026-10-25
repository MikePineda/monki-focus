// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.detectors.Rect
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.pipeline.ObservationKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The small action helpers: cover region, back loop, gate host and IME probe. */
class ActionPiecesTest {
    @Test
    fun the_cover_spans_between_the_top_and_bottom_bars() {
        val bars = listOf(Rect(0, 80, 1080, 220), Rect(0, 2250, 1080, 2400))

        assertEquals(CoverRegion(220, 2250), CoverRegion.between(bars, 2400))
    }

    @Test
    fun without_bars_the_cover_is_the_whole_screen() {
        assertEquals(CoverRegion(0, 2400), CoverRegion.between(emptyList(), 2400))
    }

    @Test
    fun the_third_back_on_the_same_surface_within_the_window_is_home() {
        val guard = BackLoopGuard()
        val reels = ObservationKey.App("com.instagram.android", "instagram.reels")

        assertEquals(BackLoopGuard.Step.BACK, guard.next(reels, 1_000))
        assertEquals(BackLoopGuard.Step.BACK, guard.next(reels, 1_400))
        assertEquals(BackLoopGuard.Step.HOME, guard.next(reels, 1_800))
    }

    @Test
    fun backs_spread_out_in_time_stay_backs() {
        val guard = BackLoopGuard()
        val reels = ObservationKey.App("com.instagram.android", "instagram.reels")

        listOf(1_000L, 3_000L, 5_000L).forEach { assertEquals(BackLoopGuard.Step.BACK, guard.next(reels, it)) }
    }

    private val typedPrompt = GateUiState.Asking("app", level = 2, requiresTypedIntention = true, requiresGuardianKey = false)
    private val optionalPrompt = typedPrompt.copy(level = 0, requiresTypedIntention = false)

    @Test
    fun gates_start_in_the_overlay() {
        assertEquals(GateHost.OVERLAY, GateHost.choose(typedPrompt, apiLevel = 35, overlayImeFailed = false))
        assertEquals(GateHost.OVERLAY, GateHost.choose(optionalPrompt, apiLevel = 29, overlayImeFailed = true))
    }

    @Test
    fun a_typed_intention_moves_to_the_activity_when_the_overlay_keyboard_cannot_be_trusted() {
        assertEquals(GateHost.ACTIVITY, GateHost.choose(typedPrompt, apiLevel = 35, overlayImeFailed = true))
        assertEquals(GateHost.ACTIVITY, GateHost.choose(typedPrompt, apiLevel = 29, overlayImeFailed = false))
    }

    @Test
    fun a_text_field_holding_the_input_without_a_keyboard_fails_the_probe() {
        val probe = ImeProbe()

        assertFalse(probe.sample(inputServed = true, imeVisible = false, nowMonotonicMs = 1_000))
        assertFalse(probe.sample(inputServed = true, imeVisible = false, nowMonotonicMs = 2_000))
        assertTrue(probe.sample(inputServed = true, imeVisible = false, nowMonotonicMs = 2_500))
    }

    @Test
    fun a_keyboard_seen_once_passes_the_probe() {
        val probe = ImeProbe()
        probe.sample(inputServed = true, imeVisible = true, nowMonotonicMs = 1_000)

        assertFalse(probe.sample(inputServed = true, imeVisible = false, nowMonotonicMs = 9_000))
    }

    @Test
    fun no_text_field_focused_is_not_a_failure() {
        val probe = ImeProbe()

        assertFalse(probe.sample(inputServed = false, imeVisible = false, nowMonotonicMs = 1_000))
        assertFalse(probe.sample(inputServed = false, imeVisible = false, nowMonotonicMs = 9_000))
    }
}
