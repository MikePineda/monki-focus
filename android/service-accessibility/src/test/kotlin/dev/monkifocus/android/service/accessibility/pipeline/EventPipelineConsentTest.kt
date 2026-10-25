// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.action.StatusCard
import dev.monkifocus.android.service.accessibility.support.BEDTIME_ON
import dev.monkifocus.android.service.accessibility.support.CHROME
import dev.monkifocus.android.service.accessibility.support.NIGHT_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RecordingPerformer.Call
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.browserScreen
import dev.monkifocus.android.service.accessibility.support.site
import dev.monkifocus.android.service.accessibility.support.surface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Protection acts only after the user armed it in our app, and never unseen (plan 04 §2). */
class EventPipelineConsentTest {
    private val redditFriction = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.FRICTION))
    private val reels = RulesData.screen("com.instagram.android/synthetic/reels-01.xml")
    private val instagramHome = RulesData.screen("com.instagram.android/synthetic/home-01.xml")
    private val setupCard = OverlayContent.Card(StatusCard.SETUP)
    private val noticeCard = OverlayContent.Card(StatusCard.NOTICE_OFF)

    private fun enforcing(calls: List<Call>) =
        calls.any {
            it == Call.Back || it == Call.Home ||
                (it is Call.Show && it.content !is OverlayContent.Card)
        }

    @Test
    fun a_service_enabled_from_settings_without_arming_enforces_nothing_and_shows_the_setup_card() {
        val h = PipelineHarness(redditFriction, armedByUser = false)

        h.pipeline.onConnected()
        h.opened(browserScreen("https://www.reddit.com/"))
        h.opened(RulesData.screen("com.android.settings/synthetic/app_info-01.xml"))

        assertEquals(setupCard, h.showing)
        assertFalse("no gate, no bounce, no BACK", enforcing(h.performer.calls))
        assertEquals(Readiness.NOT_ARMED, h.pipeline.readiness())
    }

    @Test
    fun before_arming_bedtime_blocks_nothing_at_night() {
        val h = PipelineHarness(aRuleset(bedtime = BEDTIME_ON), startWallMs = NIGHT_MS, armedByUser = false)

        h.opened(instagramHome)

        assertFalse(enforcing(h.performer.calls))
    }

    @Test
    fun the_setup_card_opens_our_app_and_can_be_dismissed() {
        val h = PipelineHarness(redditFriction, armedByUser = false)
        h.pipeline.onConnected()

        h.act(UserAction.OpenApp)
        assertTrue(Call.OpenApp(notificationSettings = false) in h.performer.calls)
        h.opened(instagramHome)
        assertEquals("still not armed: the card comes back", setupCard, h.showing)

        h.act(UserAction.DismissCard)
        h.opened(instagramHome)
        assertNull("dismissed for this session", h.showing)
    }

    @Test
    fun arming_in_the_app_starts_protection_and_removes_the_setup_card() {
        val h = PipelineHarness(aRuleset(aRule("ig-reels", surface("instagram.reels"), RuleMode.BLOCK)), armedByUser = false)
        h.pipeline.onConnected()

        h.armedByUser = true
        h.opened(reels)

        assertEquals(Call.Back, h.performer.calls.first { it == Call.Back })
        assertTrue(h.showing !is OverlayContent.Card)
    }

    @Test
    fun without_notifications_the_status_card_shows_once_before_protection_acts() {
        val h = PipelineHarness(redditFriction, noticePermitted = false)
        val page = browserScreen("https://www.reddit.com/")

        assertEquals(Readiness.AWAITING_NOTICE_CARD, h.pipeline.readiness())
        h.opened(page)
        assertEquals(noticeCard, h.showing)
        assertFalse("nothing is enforced before the card was shown", enforcing(h.performer.calls))
        assertEquals(Readiness.ACTIVE, h.pipeline.readiness())

        h.opened(page)
        assertTrue("then the gate applies, with the banner path", (h.showing as? OverlayContent.Gate) != null)
        assertEquals("the card is shown once", 1, h.performer.calls.count { it == Call.Show(noticeCard) })
    }

    @Test
    fun the_status_card_asks_to_allow_notifications() {
        val h = PipelineHarness(redditFriction, noticePermitted = false)
        h.pipeline.onConnected()
        assertEquals(noticeCard, h.showing)

        h.act(UserAction.AllowNotifications)

        assertTrue(Call.OpenApp(notificationSettings = true) in h.performer.calls)
        assertNull(h.showing)
    }

    @Test
    fun with_notifications_allowed_no_card_is_needed() {
        val h = PipelineHarness(redditFriction)

        h.pipeline.onConnected()
        h.opened(browserScreen("https://www.reddit.com/"))

        assertTrue(h.showing is OverlayContent.Gate)
        assertEquals(0, h.performer.calls.count { it is Call.Show && it.content is OverlayContent.Card })
    }

    @Test
    fun not_armed_the_tick_moves_nothing() {
        val h = PipelineHarness(redditFriction, armedByUser = false)

        h.tick(foreground = CHROME, screen = browserScreen("https://www.reddit.com/"))

        assertFalse(enforcing(h.performer.calls))
    }
}
