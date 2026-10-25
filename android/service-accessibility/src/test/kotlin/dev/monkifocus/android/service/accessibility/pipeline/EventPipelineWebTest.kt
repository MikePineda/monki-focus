// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.CoverRegion
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.decision.UnclassifiedCapRule
import dev.monkifocus.android.service.accessibility.decision.UnsupportedBrowserRule
import dev.monkifocus.android.service.accessibility.support.BEDTIME_ON
import dev.monkifocus.android.service.accessibility.support.CHROME
import dev.monkifocus.android.service.accessibility.support.NIGHT_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RecordingPerformer.Call
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.blankScreen
import dev.monkifocus.android.service.accessibility.support.browserScreen
import dev.monkifocus.android.service.accessibility.support.site
import dev.monkifocus.android.service.accessibility.support.surface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The pipeline in browsers: URL bar readings, hide-feed covers and the friction gate. */
class EventPipelineWebTest {
    private val hideRedditFeed = aRuleset(aRule("reddit-feed", surface("reddit.feed"), RuleMode.HIDE_FEED))
    private val redditFriction = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.FRICTION))

    @Test
    fun a_web_feed_with_hide_feed_is_covered_below_the_url_bar() {
        val h = PipelineHarness(hideRedditFeed)

        h.opened(browserScreen("https://www.reddit.com/"))

        assertEquals(OverlayContent.Cover(CoverRegion(top = 200, bottom = 2400)), h.showing)
    }

    @Test
    fun hide_feed_never_covers_a_permalink() {
        val h = PipelineHarness(hideRedditFeed)

        h.opened(browserScreen("https://www.reddit.com/r/sample/comments/abc/a_title"))

        assertNull(h.showing)
    }

    @Test
    fun closing_the_cover_goes_back() {
        val h = PipelineHarness(hideRedditFeed)
        h.opened(browserScreen("https://www.reddit.com/"))
        h.performer.take()

        h.act(UserAction.CoverClose)

        assertEquals(listOf(Call.Clear, Call.Back), h.performer.take())
    }

    @Test
    fun focusing_the_url_bar_removes_the_cover_and_reads_nothing() {
        val h = PipelineHarness(hideRedditFeed)
        h.opened(browserScreen("https://www.reddit.com/"))
        val reads = mutableListOf<String>()

        h.changed(browserScreen("https://www.reddit.com/", focused = true, textReads = reads))

        assertNull(h.showing)
        assertEquals("a focused URL bar is not read", emptyList<String>(), reads)
    }

    @Test
    fun an_empty_or_absent_url_bar_skips_the_decision() {
        val h = PipelineHarness(redditFriction)

        h.opened(browserScreen(url = null))
        h.opened(browserScreen(url = ""))

        assertEquals(emptyList<Call>(), h.performer.calls)
        assertEquals(EscalationPhase.IDLE, h.phaseOf("reddit"))
    }

    @Test
    fun a_page_read_in_the_url_bar_reaches_the_statistics_as_host_and_first_segment_only() {
        val h = PipelineHarness(hideRedditFeed)

        h.opened(browserScreen("https://www.reddit.com/r/sample/comments/abc/a_title?ref=x#top"))
        h.opened(browserScreen(url = ""))

        val seen = h.sitesSeen.single()
        assertEquals("reddit.com", seen.host)
        assertEquals("r", seen.firstSegment)
        assertEquals("reddit.permalink", seen.surface)
    }

    @Test
    fun page_content_is_never_read() {
        val h = PipelineHarness(redditFriction)
        val reads = mutableListOf<String>()

        h.opened(browserScreen("https://www.reddit.com/", pageText = "a private message", textReads = reads))

        assertEquals("only the URL bar's text is read", listOf("$CHROME:id/url_bar"), reads.distinct())
    }

    @Test
    fun friction_pauses_then_asks_then_lifts_on_a_committed_intention() {
        val h = PipelineHarness(redditFriction)
        val page = browserScreen("https://www.reddit.com/r/sample/comments/abc/a_title")

        h.opened(page)
        val pausing = (h.showing as OverlayContent.Gate).state as GateUiState.Pausing
        assertEquals(5, pausing.pauseSeconds)
        assertEquals("reddit.com", pausing.targetLabel)
        repeat(5) { h.tick(foreground = CHROME) }
        assertTrue((h.showing as OverlayContent.Gate).state is GateUiState.Asking)

        h.act(UserAction.Continue("reply to one message", 10))

        assertNull(h.showing)
        assertEquals(EscalationPhase.ACTIVE, h.phaseOf("reddit"))
        assertEquals(listOf("started:reddit:10:4"), h.intentions.entries)
        h.performer.take()
        h.changed(page)
        assertEquals("the intention lifts the gate", emptyList<Call>(), h.performer.calls)
    }

    @Test
    fun close_on_the_gate_goes_home_and_the_next_visit_pauses_longer() {
        val h = PipelineHarness(redditFriction)
        val page = browserScreen("https://www.reddit.com/")
        h.opened(page)
        h.performer.take()

        h.act(UserAction.Close)
        assertEquals(listOf(Call.Clear, Call.Home), h.performer.take())
        h.opened(page)

        assertEquals(15, ((h.showing as OverlayContent.Gate).state as GateUiState.Pausing).pauseSeconds)
    }

    @Test
    fun the_gate_escalates_to_a_typed_intention_on_the_third_visit() {
        val h = PipelineHarness(redditFriction)
        val page = browserScreen("https://www.reddit.com/")
        repeat(2) {
            h.opened(page)
            h.act(UserAction.Close)
        }

        h.opened(page)
        repeat(16) { h.tick(foreground = CHROME) }

        val asking = (h.showing as OverlayContent.Gate).state as GateUiState.Asking
        assertTrue(asking.requiresTypedIntention)
    }

    @Test
    fun leaving_for_an_app_we_do_not_watch_removes_the_overlay() {
        val h = PipelineHarness(redditFriction)
        h.opened(browserScreen("https://www.reddit.com/"))
        h.performer.take()

        h.tick(foreground = "org.example.launcher")

        assertEquals(listOf(Call.Clear), h.performer.take())
        assertNull(h.showing)
    }

    @Test
    fun an_intention_that_runs_out_on_screen_shows_the_timeout_card() {
        val h = PipelineHarness(redditFriction)
        val page = browserScreen("https://www.reddit.com/")
        h.opened(page)
        repeat(5) { h.tick(foreground = CHROME) }
        h.act(UserAction.Continue("", 5))

        h.tick(foreground = CHROME, screen = page, afterMs = 5 * 60_000L)

        assertTrue((h.showing as OverlayContent.Gate).state is GateUiState.Timeout)
    }

    private val otherBrowser = "org.example.browser"

    @Test
    fun a_browser_no_pack_can_read_gets_app_friction_always() {
        val h = PipelineHarness(redditFriction, unsupportedBrowsers = setOf(otherBrowser))

        h.opened(blankScreen(otherBrowser))

        val gate = h.showing as OverlayContent.Gate
        assertEquals(UnsupportedBrowserRule.idFor(otherBrowser), gate.group)
        assertTrue(gate.state is GateUiState.Pausing)
    }

    @Test
    fun a_browser_no_pack_can_read_is_blocked_at_bedtime() {
        val h =
            PipelineHarness(redditFriction.copy(bedtime = BEDTIME_ON), startWallMs = NIGHT_MS, unsupportedBrowsers = setOf(otherBrowser))

        h.opened(blankScreen(otherBrowser))

        assertTrue((h.showing as OverlayContent.Gate).state is GateUiState.BedtimeCover)
    }

    @Test
    fun an_unreadable_browser_is_left_alone_when_no_rule_restricts_the_web() {
        val h = PipelineHarness(aRuleset(), unsupportedBrowsers = setOf(otherBrowser))

        h.opened(blankScreen(otherBrowser))

        assertNull(h.showing)
    }

    @Test
    fun a_url_bar_hidden_past_the_grace_counts_toward_the_cap_and_ends_in_friction() {
        val h = PipelineHarness(redditFriction)
        val noBar = browserScreen(url = null)
        h.opened(noBar)

        repeat(14) { h.tick(foreground = CHROME, screen = noBar, afterMs = 30_000) }

        val gate = h.showing as OverlayContent.Gate
        assertEquals(UnclassifiedCapRule.idFor(CHROME), gate.group)
    }

    @Test
    fun a_url_bar_hidden_only_briefly_changes_nothing() {
        val h = PipelineHarness(redditFriction)
        val noBar = browserScreen(url = null)

        repeat(20) {
            h.changed(noBar, afterMs = 15_000)
            h.changed(browserScreen("https://example.org/article"), afterMs = 15_000)
        }

        assertNull(h.showing)
    }

    @Test
    fun a_gate_left_with_home_comes_back_when_the_app_is_reopened() {
        val h = PipelineHarness(redditFriction)
        val page = browserScreen("https://www.reddit.com/")
        h.opened(page)
        h.performer.onTop = false
        h.performer.take()

        h.opened(page)

        val shown =
            h.performer
                .take()
                .filterIsInstance<Call.Show>()
                .map { it.content }
        assertEquals(listOf("reddit"), shown.map { (it as OverlayContent.Gate).group })
    }

    @Test
    fun the_tick_puts_the_gate_back_while_the_watched_app_is_in_front() {
        val h = PipelineHarness(redditFriction)
        h.opened(browserScreen("https://www.reddit.com/"))
        h.performer.onTop = false
        h.performer.take()

        h.tick(foreground = CHROME)

        assertTrue(h.performer.calls.any { it is Call.Show })
        assertTrue(h.performer.onTop)
    }
}
