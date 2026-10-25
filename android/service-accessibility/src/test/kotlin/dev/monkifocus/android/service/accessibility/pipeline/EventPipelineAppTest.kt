// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.decision.UnclassifiedCapRule
import dev.monkifocus.android.service.accessibility.support.BEDTIME_ON
import dev.monkifocus.android.service.accessibility.support.NIGHT_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RecordingPerformer.Call
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.YOUTUBE
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.blankScreen
import dev.monkifocus.android.service.accessibility.support.surface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The pipeline on app screens, with the real engine, packs and synthetic dumps. */
class EventPipelineAppTest {
    private val reelsBlock = aRuleset(aRule("ig-reels", surface("instagram.reels"), RuleMode.BLOCK))

    private fun screen(dump: String) = RulesData.screen("com.instagram.android/synthetic/$dump.xml")

    @Test
    fun blocked_reels_go_back_and_leave_a_notice_with_emergency_access() {
        val h = PipelineHarness(reelsBlock)

        h.opened(screen("reels-01"))

        val calls = h.performer.take()
        assertEquals(Call.Back, calls.first())
        val notice = h.showing as OverlayContent.Gate
        assertTrue(notice.notice)
        assertEquals("ig-reels", notice.group)
        val blocked = notice.state as GateUiState.Blocked
        assertEquals(ExplanationKey.BLOCKED_BY_RULE, blocked.explanationKey)
        assertTrue("emergency access is always offered for a rule block", blocked.emergencyAvailable)
    }

    @Test
    fun closing_the_notice_only_dismisses_it() {
        val h = PipelineHarness(reelsBlock)
        h.opened(screen("reels-01"))
        h.performer.take()

        h.act(UserAction.Close)

        assertEquals(listOf(Call.Clear), h.performer.take())
        assertNull(h.showing)
    }

    @Test
    fun the_notice_stays_while_the_user_is_back_in_the_inbox() {
        val h = PipelineHarness(reelsBlock)
        h.opened(screen("reels-01"))

        h.opened(screen("direct-01"))

        assertTrue((h.showing as OverlayContent.Gate).notice)
    }

    @Test
    fun a_dm_reel_opened_from_the_inbox_stays_open() {
        val h = PipelineHarness(reelsBlock)
        h.opened(screen("direct-01"))

        h.opened(screen("reel_from_dm-01"))

        assertFalse(Call.Back in h.performer.calls)
        assertNull(h.showing)
    }

    @Test
    fun a_dm_reel_without_the_inbox_first_is_blocked_as_reels() {
        val h = PipelineHarness(reelsBlock)

        h.opened(screen("reel_from_dm-01"))

        assertEquals(Call.Back, h.performer.calls.first())
    }

    @Test
    fun a_dm_reel_session_ends_after_two_minutes() {
        val h = PipelineHarness(reelsBlock)
        h.opened(screen("direct-01"))
        h.opened(screen("reel_from_dm-01"))
        repeat(121) { h.changed(screen("reel_from_dm-01"), afterMs = 1_000) }

        assertEquals(Call.Back, h.performer.calls.first())
    }

    @Test
    fun back_that_does_not_leave_the_blocked_surface_goes_home() {
        val h = PipelineHarness(reelsBlock)

        h.opened(screen("reels-01"), afterMs = 300)
        h.opened(screen("reels-01"), afterMs = 300)
        h.opened(screen("reels-01"), afterMs = 300)

        val globals = h.performer.calls.filter { it == Call.Back || it == Call.Home }
        assertEquals(listOf(Call.Back, Call.Back, Call.Home), globals)
    }

    @Test
    fun youtube_shorts_of_the_starter_preset_go_back() {
        val h = PipelineHarness(RulesData.starter.copy(bedtime = BEDTIME_ON.copy(enabled = false)))

        h.opened(RulesData.screen("com.google.android.youtube/synthetic/shorts-01.xml"))

        assertEquals(Call.Back, h.performer.calls.first())
    }

    @Test
    fun emergency_access_from_the_notice_waits_two_minutes_records_a_bypass_and_opens_reels() {
        val h = PipelineHarness(reelsBlock)
        h.opened(screen("reels-01"))

        h.act(UserAction.Emergency)
        assertTrue((h.showing as OverlayContent.Gate).state is GateUiState.EmergencyWait)
        h.tick(foreground = "com.instagram.android", afterMs = 121_000)

        assertEquals(listOf("emergency_override"), h.bypassEvents.map { it.kind })
        assertEquals("ig-reels", h.bypassEvents.single().details["target_group"])
        assertNull(h.showing)
        h.performer.take()
        h.opened(screen("reels-01"))
        assertFalse(Call.Back in h.performer.calls)
    }

    @Test
    fun bedtime_is_evaluated_on_each_event_and_covers_the_app() {
        val h = PipelineHarness(aRuleset(bedtime = BEDTIME_ON), startWallMs = NIGHT_MS)

        h.opened(screen("home-01"))

        assertTrue((h.showing as OverlayContent.Gate).state is GateUiState.BedtimeCover)
    }

    @Test
    fun the_same_app_is_open_in_the_morning_without_any_alarm() {
        val h = PipelineHarness(aRuleset(bedtime = BEDTIME_ON))

        h.opened(screen("home-01"))

        assertNull(h.showing)
    }

    @Test
    fun unclassified_screens_of_a_capped_app_get_app_friction_after_the_cap() {
        val h = PipelineHarness(RulesData.starter.copy(bedtime = BEDTIME_ON.copy(enabled = false)))
        val unknown = blankScreen(YOUTUBE)
        h.opened(unknown)
        assertNull(h.showing)

        // No events at all while a video plays: only the periodic tick keeps the cap fed.
        repeat(20) { h.tick(foreground = YOUTUBE, screen = unknown, afterMs = 30_000) }

        val gate = h.showing as OverlayContent.Gate
        assertEquals(UnclassifiedCapRule.idFor(YOUTUBE), gate.group)
        assertTrue(gate.state is GateUiState.Pausing)
    }

    @Test
    fun the_cap_is_fed_at_least_every_minute_while_a_capped_app_is_in_front() {
        val h = PipelineHarness(RulesData.starter.copy(bedtime = BEDTIME_ON.copy(enabled = false)))

        h.opened(blankScreen(YOUTUBE))

        val delay = requireNotNull(h.pipeline.nextTickDelayMs())
        assertTrue("next tick in $delay ms", delay <= 60_000)
    }

    @Test
    fun a_cap_rule_never_applies_to_an_app_without_a_surface_block_rule() {
        val h = PipelineHarness(aRuleset())
        val unknown = blankScreen(YOUTUBE)
        h.opened(unknown)

        repeat(40) { h.tick(foreground = YOUTUBE, screen = unknown, afterMs = 30_000) }

        assertNull(h.showing)
        assertEquals(EscalationPhase.IDLE, h.phaseOf(UnclassifiedCapRule.idFor(YOUTUBE)))
    }
}
