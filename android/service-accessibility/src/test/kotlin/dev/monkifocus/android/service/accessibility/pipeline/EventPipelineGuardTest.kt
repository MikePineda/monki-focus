// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RecordingPerformer.Call
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.SETTINGS
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The anti-bypass guard, its visible bounce card and "Exit and unlink" through the pipeline. */
class EventPipelineGuardTest {
    private fun settings(dump: String) = RulesData.screen("com.android.settings/synthetic/$dump.xml")

    private val instagramHome = RulesData.screen("com.instagram.android/synthetic/home-01.xml")

    @Test
    fun our_app_info_shows_a_visible_bounce_card_never_a_silent_block() {
        val h = PipelineHarness()

        h.opened(settings("app_info-01"))

        val card = h.showing as OverlayContent.Bounce
        assertEquals(GuardedScreen.APP_INFO, card.screen)
        assertNull("no exit wait yet", card.exitRemainingSeconds)
        assertFalse("the card is the bounce: no silent BACK", Call.Back in h.performer.calls)
    }

    @Test
    fun our_accessibility_detail_is_guarded_without_a_label_lookup() {
        val h = PipelineHarness()

        h.opened(settings("accessibility_detail-01"))

        assertEquals(GuardedScreen.ACCESSIBILITY_DETAIL, (h.showing as OverlayContent.Bounce).screen)
        assertEquals(0, h.collisionChecks)
    }

    @Test
    fun a_label_collision_releases_the_app_info_guard() {
        val h = PipelineHarness(labelCollision = true)

        h.opened(settings("app_info-01"))

        assertNull(h.showing)
        assertEquals(1, h.collisionChecks)
    }

    @Test
    fun other_apps_settings_screens_are_never_guarded() {
        val h = PipelineHarness()

        h.opened(settings("app_info-02"))
        h.opened(settings("accessibility_list-01"))

        assertNull(h.showing)
        assertEquals(emptyList<Call>(), h.performer.calls)
    }

    @Test
    fun go_back_on_the_bounce_card_goes_back() {
        val h = PipelineHarness()
        h.opened(settings("app_info-01"))
        h.performer.take()

        h.act(UserAction.BounceBack)

        assertEquals(listOf(Call.Clear, Call.Back), h.performer.take())
    }

    @Test
    fun disable_protection_on_the_card_starts_the_two_minute_exit_and_shows_it() {
        val h = PipelineHarness()
        h.opened(settings("app_info-01"))

        h.act(UserAction.DisableProtection)

        assertEquals(120, (h.showing as OverlayContent.Bounce).exitRemainingSeconds)
        h.tick(foreground = SETTINGS, afterMs = 30_000)
        assertEquals(90, (h.showing as OverlayContent.Bounce).exitRemainingSeconds)
    }

    @Test
    fun keep_protection_cancels_the_exit_wait() {
        val h = PipelineHarness()
        h.opened(settings("app_info-01"))
        h.act(UserAction.DisableProtection)

        h.act(UserAction.KeepProtection)

        assertEquals(ExitFlowState.Armed, h.exitStore.stored)
        assertNull((h.showing as OverlayContent.Bounce).exitRemainingSeconds)
    }

    @Test
    fun the_exit_ends_protection_after_two_minutes_neutrally_and_disarms_everything() {
        val h = PipelineHarness()
        h.opened(settings("app_info-01"))
        h.act(UserAction.DisableProtection)

        h.tick(foreground = SETTINGS, afterMs = 121_000)

        assertTrue(h.exitStore.stored is ExitFlowState.Ended)
        assertEquals(listOf("protection_ended"), h.bypassEvents.map { it.kind })
        assertEquals(emptyMap<String, String>(), h.bypassEvents.single().details)
        assertEquals(listOf("disarm_device_admin", "stop_protection"), h.disarmer.calls)
        assertNull(h.showing)
    }

    @Test
    fun after_the_exit_nothing_is_guarded_or_enforced() {
        val h = PipelineHarness()
        h.opened(settings("app_info-01"))
        h.act(UserAction.DisableProtection)
        h.tick(foreground = SETTINGS, afterMs = 121_000)
        h.performer.take()

        h.opened(settings("app_info-01"))
        h.opened(RulesData.screen("com.instagram.android/synthetic/reels-01.xml"))

        assertEquals(emptyList<Call>(), h.performer.calls)
    }

    @Test
    fun an_engine_error_blocks_without_emergency_but_never_the_exit() {
        val h = PipelineHarness(ruleset = null, loadFailed = true)

        h.opened(instagramHome)
        val blocked = (h.showing as OverlayContent.Gate).state as GateUiState.Blocked
        assertEquals(ExplanationKey.ENGINE_ERROR, blocked.explanationKey)
        assertFalse("nothing lifts an engine error", blocked.emergencyAvailable)

        h.opened(settings("accessibility_detail-01"))
        h.act(UserAction.DisableProtection)
        h.tick(foreground = SETTINGS, afterMs = 121_000)

        assertTrue(h.exitStore.stored is ExitFlowState.Ended)
        assertEquals(listOf("disarm_device_admin", "stop_protection"), h.disarmer.calls)
    }

    @Test
    fun close_on_an_engine_error_still_goes_home() {
        val h = PipelineHarness(ruleset = null, loadFailed = true)
        h.opened(instagramHome)
        h.performer.take()

        h.act(UserAction.Close)

        assertEquals(listOf(Call.Clear, Call.Home), h.performer.take())
    }

    @Test
    fun nothing_is_decided_before_the_rules_are_loaded() {
        val h = PipelineHarness(ruleset = null)

        h.opened(instagramHome)

        assertEquals(emptyList<Call>(), h.performer.calls)
    }
}
