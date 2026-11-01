// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.action.TypedAddress
import dev.monkifocus.android.service.accessibility.support.BEDTIME_ON
import dev.monkifocus.android.service.accessibility.support.CHROME
import dev.monkifocus.android.service.accessibility.support.INSTAGRAM
import dev.monkifocus.android.service.accessibility.support.NIGHT_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RecordingPerformer.Call
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.app
import dev.monkifocus.android.service.accessibility.support.blankScreen
import dev.monkifocus.android.service.accessibility.support.browserScreen
import dev.monkifocus.android.service.accessibility.support.site
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A blocked page never makes the whole browser unusable: from a blocked or
 * gated page the user reaches any allowed site in the same browser, also
 * when the browser restores the blocked tab on launch. Only the blocked
 * site stays blocked.
 */
class EventPipelineAnotherSiteTest {
    private val redditBlock = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.BLOCK))
    private val redditFriction = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.FRICTION))
    private val reddit = browserScreen("https://www.reddit.com/")

    private val PipelineHarness.gate: OverlayContent.Gate get() = showing as OverlayContent.Gate

    @Test
    fun restored_blocked_tab_still_lets_the_user_open_another_site() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.Close)
        h.performer.onTop = false

        // The browser is opened again and restores the blocked tab.
        h.opened(reddit)
        assertTrue("the block offers another site", h.gate.offersAnotherSite)
        h.act(UserAction.AnotherSite)
        assertTrue("the address entry is on screen", h.gate.typingAddress)
        h.performer.take()
        h.act(UserAction.GoTo("weather.example"))

        assertEquals(
            listOf(Call.Open(CHROME, TypedAddress.Web("https://weather.example", "weather.example")), Call.Clear),
            h.performer.take(),
        )
        h.opened(browserScreen("https://weather.example/"))
        assertNull("the other site is usable in the same browser", h.showing)
    }

    @Test
    fun the_blocked_site_stays_blocked_after_going_elsewhere() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.act(UserAction.GoTo("weather.example"))
        h.opened(browserScreen("https://weather.example/"))

        h.opened(reddit)

        assertTrue(h.gate.state is GateUiState.Blocked)
    }

    @Test
    fun a_typed_address_that_is_blocked_shows_the_block_again_and_opens_nothing() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.performer.take()

        h.act(UserAction.GoTo("old.reddit.com/r/sample"))

        assertTrue(h.performer.calls.none { it is Call.Open })
        val blocked = h.gate.state as GateUiState.Blocked
        assertEquals("old.reddit.com", blocked.targetLabel)
        assertFalse("back on the block screen, not the entry", h.gate.typingAddress)
        assertTrue("which still offers another site", h.gate.offersAnotherSite)
    }

    @Test
    fun plain_words_become_a_search_in_the_same_browser() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.performer.take()

        h.act(UserAction.GoTo("weather today"))

        assertEquals(listOf(Call.Open(CHROME, TypedAddress.Search("weather today")), Call.Clear), h.performer.take())
    }

    @Test
    fun a_search_the_browser_cannot_take_fires_nothing_and_asks_for_a_web_address() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.performer.opens = false
        h.performer.take()

        h.act(UserAction.GoTo("weather today"))

        assertTrue("no intent fired, no overlay removed", h.performer.calls.none { it is Call.Open || it == Call.Clear })
        assertTrue(h.gate.typingAddress)
        assertTrue(h.gate.addressUnopened)
        assertEquals("the gate is not left", EscalationPhase.IDLE, h.phaseOf("reddit"))
        h.performer.opens = true
        h.act(UserAction.GoTo("weather.example"))
        assertTrue("a web address still opens", h.performer.calls.any { it is Call.Open })
        assertNull(h.showing)
    }

    @Test
    fun an_upper_case_address_with_a_trailing_dot_of_a_blocked_site_is_still_blocked() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.performer.take()

        h.act(UserAction.GoTo("HTTPS://WWW.REDDIT.COM."))

        assertTrue(h.performer.calls.none { it is Call.Open })
        assertEquals("reddit.com", (h.gate.state as GateUiState.Blocked).targetLabel)
    }

    @Test
    fun the_prompt_offers_go_back_and_another_site() {
        val h = PipelineHarness(redditFriction)
        h.opened(reddit)
        repeat(5) { h.tick(foreground = CHROME) }
        assertTrue(h.gate.state is GateUiState.Asking)
        assertTrue(h.gate.offersAnotherSite)
        h.performer.take()

        h.act(UserAction.GoBack)

        assertEquals(listOf(Call.Clear, Call.Back), h.performer.take())
        h.opened(reddit)
        repeat(15) { h.tick(foreground = CHROME) }
        h.act(UserAction.AnotherSite)
        h.act(UserAction.GoTo("weather.example"))
        assertTrue(h.performer.calls.any { it is Call.Open })
    }

    @Test
    fun the_timeout_card_offers_go_back_and_another_site() {
        val h = PipelineHarness(redditFriction)
        h.opened(reddit)
        repeat(5) { h.tick(foreground = CHROME) }
        h.act(UserAction.Continue("", 5))
        h.tick(foreground = CHROME, screen = reddit, afterMs = 5 * 60_000L)
        assertTrue(h.gate.state is GateUiState.Timeout)
        assertTrue(h.gate.offersAnotherSite)

        h.act(UserAction.AnotherSite)
        h.performer.take()
        h.act(UserAction.GoTo("weather.example"))

        assertEquals(
            listOf(Call.Open(CHROME, TypedAddress.Web("https://weather.example", "weather.example")), Call.Clear),
            h.performer.take(),
        )
        assertEquals("going elsewhere from the timeout is leaving", EscalationPhase.IDLE, h.phaseOf("reddit"))
    }

    @Test
    fun close_reaching_a_closing_gate_activity_after_go_back_does_not_go_home() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.GoBack)
        h.performer.take()

        h.act(UserAction.Close)

        assertEquals(emptyList<Call>(), h.performer.take())
    }

    @Test
    fun a_blank_address_opens_nothing_and_keeps_the_entry() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.performer.take()

        h.act(UserAction.GoTo("  "))

        assertTrue(h.performer.calls.none { it is Call.Open || it == Call.Clear })
        assertTrue(h.gate.typingAddress)
    }

    @Test
    fun cancelling_the_entry_returns_to_the_block_screen() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)

        h.act(UserAction.CancelAnotherSite)

        assertFalse(h.gate.typingAddress)
        assertTrue(h.gate.state is GateUiState.Blocked)
    }

    @Test
    fun the_entry_stays_on_screen_while_the_blocked_page_is_still_read_behind_it() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.act(UserAction.AnotherSite)

        h.changed(reddit)
        h.tick(foreground = CHROME, screen = reddit)

        assertTrue(h.gate.typingAddress)
    }

    @Test
    fun go_back_leaves_the_blocked_page_with_back() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)
        h.performer.take()

        h.act(UserAction.GoBack)

        assertEquals(listOf(Call.Clear, Call.Back), h.performer.take())
    }

    @Test
    fun a_declined_gate_reopened_on_a_restored_tab_lets_the_user_open_another_site() {
        val h = PipelineHarness(redditFriction)
        h.opened(reddit)
        h.act(UserAction.Close)
        h.performer.onTop = false

        h.opened(reddit)
        assertTrue(h.gate.state is GateUiState.Pausing)
        assertTrue(h.gate.offersAnotherSite)
        h.act(UserAction.AnotherSite)
        h.performer.take()
        h.act(UserAction.GoTo("weather.example"))

        assertTrue(h.performer.calls.contains(Call.Open(CHROME, TypedAddress.Web("https://weather.example", "weather.example"))))
        assertEquals("going elsewhere counts as leaving the gate", EscalationPhase.IDLE, h.phaseOf("reddit"))
    }

    @Test
    fun a_typed_address_behind_friction_is_opened_and_gated_by_the_browser_reading() {
        val h =
            PipelineHarness(
                aRuleset(aRule("reddit", site("reddit.com"), RuleMode.BLOCK), aRule("news", site("news.example"), RuleMode.FRICTION)),
            )
        h.opened(reddit)
        h.act(UserAction.AnotherSite)
        h.act(UserAction.GoTo("news.example"))
        assertTrue(h.performer.calls.contains(Call.Open(CHROME, TypedAddress.Web("https://news.example", "news.example"))))

        h.opened(browserScreen("https://news.example/"))

        assertTrue(h.gate.state is GateUiState.Pausing)
    }

    @Test
    fun an_app_block_offers_no_other_site() {
        val h = PipelineHarness(aRuleset(aRule("instagram", app(INSTAGRAM), RuleMode.BLOCK)))

        h.opened(blankScreen(INSTAGRAM))

        assertFalse(h.gate.offersAnotherSite)
        assertWayOutRejected(h)
    }

    @Test
    fun bedtime_is_unchanged_and_offers_no_other_site() {
        val h = PipelineHarness(redditBlock.copy(bedtime = BEDTIME_ON), startWallMs = NIGHT_MS)

        h.opened(reddit)

        assertTrue(h.gate.state is GateUiState.BedtimeCover)
        assertFalse(h.gate.offersAnotherSite)
        assertWayOutRejected(h)
    }

    @Test
    fun an_engine_error_offers_no_other_site() {
        val h = PipelineHarness(ruleset = null, loadFailed = true)

        h.opened(reddit)

        assertEquals(ExplanationKey.ENGINE_ERROR, (h.gate.state as GateUiState.Blocked).explanationKey)
        assertFalse(h.gate.offersAnotherSite)
        assertWayOutRejected(h)
    }

    @Test
    fun the_emergency_wait_offers_no_other_site() {
        val h = PipelineHarness(redditBlock)
        h.opened(reddit)

        h.act(UserAction.Emergency)

        assertTrue(h.gate.state is GateUiState.EmergencyWait)
        assertFalse(h.gate.offersAnotherSite)
        assertWayOutRejected(h)
    }

    /** "Go to another site", "Go" and "Go back" sent where they are not offered change nothing. */
    private fun assertWayOutRejected(h: PipelineHarness) {
        val before = h.showing
        h.performer.take()

        h.act(UserAction.AnotherSite)
        h.act(UserAction.GoTo("weather.example"))
        h.act(UserAction.GoBack)

        assertEquals(emptyList<Call>(), h.performer.take())
        assertEquals(before, h.showing)
    }

    @Test
    fun the_typed_address_never_reaches_to_string() {
        assertEquals("GoTo(⟨address⟩)", UserAction.GoTo("a private address").toString())
    }
}
