// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Surface
import dev.monkifocus.android.core.domain.rules.SurfaceKind
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesState
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.rules.edit.MissingStarterRules
import dev.monkifocus.android.feature.rules.edit.SurfaceRuleOptions
import dev.monkifocus.android.feature.rules.support.InMemoryRulesetRepository
import dev.monkifocus.android.feature.rules.support.MutableClock
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SurfaceRulePickerTest {
    @get:Rule
    val compose = createComposeRule()

    private val surfaces =
        listOf(
            Surface("instagram.reels", "instagram", SurfaceKind.FEED, shortVideo = true),
            Surface("instagram.explore", "instagram", SurfaceKind.FEED),
            Surface("instagram.post", "instagram", SurfaceKind.PERMALINK),
            Surface("youtube.home", "youtube", SurfaceKind.FEED),
            Surface("youtube.shorts", "youtube", SurfaceKind.FEED, shortVideo = true),
            Surface("youtube.search", "youtube", SurfaceKind.UTILITY),
        )
    private val starter =
        aRuleset(
            rules =
                listOf(
                    aRule("starter-youtube-shorts-block", SurfaceTarget("youtube.shorts"), RuleMode.BLOCK),
                    aRule("starter-instagram-explore-hide", SurfaceTarget("instagram.explore"), RuleMode.HIDE_FEED),
                ),
        )
    private val ruleset = aRuleset()
    private val edits = mutableListOf<Ruleset>()

    private fun show(
        configured: Ruleset = ruleset,
        withStarter: Ruleset? = starter,
    ) {
        val actions = RulesActions({}, { edits += it(configured) }, {}, {}, {})
        compose.setContent {
            MonkiTheme {
                RulesScreen(
                    RulesState(configured, null),
                    null,
                    actions,
                    surfaces = surfaces,
                    starter = withStarter,
                )
            }
        }
    }

    @Test
    fun a_picked_feed_and_mode_is_added_as_a_surface_rule() {
        show()

        compose.onNodeWithTag(RulesTestTags.addFamily("youtube")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.addSurface("youtube.home")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.addMode("block")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.ADD_SAVE).performScrollTo().performClick()

        assertEquals(SurfaceRuleOptions.add(ruleset, "youtube.home", RuleMode.BLOCK), edits.single())
    }

    @Test
    fun the_picker_never_offers_a_permalink_or_a_utility() {
        show()

        compose.onNodeWithTag(RulesTestTags.addFamily("instagram")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.addSurface("instagram.reels")).performScrollTo().assertExists()
        compose.onNodeWithTag(RulesTestTags.addSurface("instagram.post")).assertDoesNotExist()
        compose.onNodeWithTag(RulesTestTags.addMode("friction")).assertDoesNotExist()
        compose.onNodeWithTag(RulesTestTags.addMode("allow")).assertDoesNotExist()
    }

    @Test
    fun a_short_video_feed_is_added_as_block_unless_the_user_picks_hide_feed() {
        show()

        compose.onNodeWithTag(RulesTestTags.addFamily("instagram")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.addSurface("instagram.reels")).performScrollTo().performClick()
        compose.onNodeWithTag(RulesTestTags.ADD_SAVE).performScrollTo().performClick()

        assertEquals(
            RuleMode.BLOCK,
            edits
                .single()
                .rules
                .last()
                .mode,
        )
    }

    @Test
    fun suggested_rules_name_what_they_add_and_add_it_in_one_tap() {
        show()

        compose.onNodeWithText("YouTube Shorts", substring = true).performScrollTo().assertExists()
        compose.onNodeWithTag(RulesTestTags.SUGGESTED_ADD).performScrollTo().performClick()

        assertEquals(MissingStarterRules.addTo(ruleset, starter), edits.single())
    }

    @Test
    fun suggested_rules_are_hidden_when_nothing_is_missing() {
        show(configured = MissingStarterRules.addTo(ruleset, starter))

        compose.onNodeWithTag(RulesTestTags.SUGGESTED_ADD).assertDoesNotExist()
    }

    @Test
    fun adding_suggested_rules_through_the_route_applies_at_once() {
        val repository = InMemoryRulesetRepository(ruleset)
        val service = RuleChangeService(repository, RulesData.catalog, RulesetCheck.of(RulesData.validator), { starter }, MutableClock(NOW))
        compose.setContent {
            MonkiTheme { RulesRoute(service, { RulesData.validator }, onBack = {}, surfaces = { surfaces }, starter = { starter }) }
        }

        compose.waitUntil(TIMEOUT_MS) { compose.onAllNodesWithTag(RulesTestTags.SUGGESTED_ADD).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithTag(RulesTestTags.SUGGESTED_ADD).performScrollTo().performClick()
        compose.waitUntil(TIMEOUT_MS) { compose.onAllNodesWithTag(RulesTestTags.SUGGESTED_ADD).fetchSemanticsNodes().isEmpty() }

        val active = runBlocking { repository.active(NOW) }?.ruleset
        assertEquals(
            listOf("site-example", "starter-youtube-shorts-block", "starter-instagram-explore-hide"),
            active?.rules?.map { it.id },
        )
        assertNull("a tightening never waits", runBlocking { repository.pending(NOW) })
    }

    private companion object {
        const val NOW = "2026-10-27T10:00:00Z"
        const val TIMEOUT_MS = 5_000L
    }
}
