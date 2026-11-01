// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Surface
import dev.monkifocus.android.core.domain.rules.SurfaceKind
import dev.monkifocus.android.core.domain.rules.SurfaceRegistry
import dev.monkifocus.android.core.domain.rules.SurfaceTarget
import dev.monkifocus.android.core.domain.validation.ValidationResult
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SurfaceRuleOptionsTest {
    private val surfaces =
        listOf(
            Surface("video.home", "video", SurfaceKind.FEED),
            Surface("video.shorts", "video", SurfaceKind.FEED, shortVideo = true),
            Surface("video.watch", "video", SurfaceKind.PERMALINK),
            Surface("video.search", "video", SurfaceKind.UTILITY),
            Surface("board.feed", "board", SurfaceKind.FEED),
            Surface("board.messages", "board", SurfaceKind.UTILITY),
        )
    private val options = SurfaceRuleOptions(surfaces)

    @Test
    fun only_families_with_a_feed_surface_are_offered_in_name_order() {
        val withUtilityOnly = SurfaceRuleOptions(surfaces + Surface("chat.inbox", "chat", SurfaceKind.UTILITY))

        assertEquals(listOf("board", "video"), withUtilityOnly.families)
    }

    @Test
    fun permalinks_and_utilities_are_never_offered_for_a_surface_rule() {
        assertEquals(listOf("video.home", "video.shorts"), options.surfacesOf("video").map { it.id })
        assertEquals(emptyList<Surface>(), options.surfacesOf("unknown"))
    }

    @Test
    fun a_feed_surface_offers_hide_feed_or_block() {
        assertEquals(listOf(RuleMode.HIDE_FEED, RuleMode.BLOCK), SurfaceRuleOptions.MODES)
    }

    @Test
    fun a_short_video_feed_defaults_to_block_and_any_other_feed_to_hide_feed() {
        assertEquals(RuleMode.BLOCK, SurfaceRuleOptions.defaultMode(surfaces[1]))
        assertEquals(RuleMode.HIDE_FEED, SurfaceRuleOptions.defaultMode(surfaces[0]))
    }

    @Test
    fun adding_a_surface_rule_appends_an_always_on_rule_with_a_unique_id() {
        val ruleset = aRuleset(rules = listOf(aRule("surface-video-shorts", SurfaceTarget("video.shorts"))))

        val added = SurfaceRuleOptions.add(ruleset, "video.shorts", RuleMode.BLOCK).rules.last()

        assertEquals("surface-video-shorts-2", added.id)
        assertEquals(SurfaceTarget("video.shorts"), added.target)
        assertEquals(RuleMode.BLOCK to true, added.mode to added.enabled)
        assertTrue(added.schedules.isEmpty())
    }

    @Test
    fun every_bundled_feed_surface_with_either_mode_makes_a_valid_rule_set() {
        val bundled = RulesJson.decodeFromString(SurfaceRegistry.serializer(), RulesData.file("data/surfaces.json").readText()).surfaces
        val bundledOptions = SurfaceRuleOptions(bundled)
        val check = RulesetCheck.of(RulesData.validator)

        bundledOptions.families.flatMap { bundledOptions.surfacesOf(it) }.forEach { surface ->
            SurfaceRuleOptions.MODES.forEach { mode ->
                val verdict = check.check(SurfaceRuleOptions.add(aRuleset(), surface.id, mode))
                assertEquals("${surface.id} $mode", ValidationResult.Valid, verdict)
            }
        }
    }
}
