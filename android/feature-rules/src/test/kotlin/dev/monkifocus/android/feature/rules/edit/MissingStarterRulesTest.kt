// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test

class MissingStarterRulesTest {
    private val starter =
        aRuleset(
            rules =
                listOf(
                    aRule("starter-video-shorts-block", SurfaceTarget("video.shorts"), RuleMode.BLOCK),
                    aRule("starter-board-feed-hide", SurfaceTarget("board.feed"), RuleMode.HIDE_FEED),
                    aRule("starter-video-home-hide", SurfaceTarget("video.home"), RuleMode.HIDE_FEED),
                    aRule("starter-board-friction", SiteTarget("board.example")),
                ),
        )

    @Test
    fun suggested_rules_are_the_starter_surface_rules_missing_by_id() {
        val stored = aRuleset(rules = listOf(aRule("starter-board-feed-hide", SurfaceTarget("board.feed"), RuleMode.BLOCK)))

        val missing = MissingStarterRules.of(stored, starter).map { it.id }

        assertEquals(listOf("starter-video-shorts-block", "starter-video-home-hide"), missing)
    }

    @Test
    fun a_surface_the_user_already_has_a_rule_for_is_not_suggested_again() {
        val stored = aRuleset(rules = listOf(aRule("my-shorts", SurfaceTarget("video.shorts"), RuleMode.HIDE_FEED)))

        val missing = MissingStarterRules.of(stored, starter).map { it.id }

        assertEquals(listOf("starter-board-feed-hide", "starter-video-home-hide"), missing)
    }

    @Test
    fun site_rules_of_the_starter_are_never_suggested() {
        val missing = MissingStarterRules.of(aRuleset(rules = emptyList()), starter)

        assertFalse(missing.any { it.target is SiteTarget })
    }

    @Test
    fun suggested_rules_add_only_missing_starter_rules() {
        val stored = aRuleset(rules = listOf(aRule(), aRule("starter-video-shorts-block", SurfaceTarget("video.shorts"), RuleMode.BLOCK)))

        val added = MissingStarterRules.addTo(stored, starter)

        assertEquals(stored.rules, added.rules.take(2))
        assertEquals(listOf("starter-board-feed-hide", "starter-video-home-hide"), added.rules.drop(2).map { it.id })
    }

    @Test
    fun nothing_missing_leaves_the_rule_set_untouched() {
        val complete = MissingStarterRules.addTo(aRuleset(rules = emptyList()), starter)

        assertSame(complete, MissingStarterRules.addTo(complete, starter))
    }
}
