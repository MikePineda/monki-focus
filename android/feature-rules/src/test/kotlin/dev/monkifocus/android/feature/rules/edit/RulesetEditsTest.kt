// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.Weekday
import dev.monkifocus.android.core.domain.validation.ValidationResult
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.feature.rules.support.RulesData
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRule
import dev.monkifocus.android.feature.rules.support.RulesetFactory.aRuleset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class RulesetEditsTest {
    @Test
    fun a_mode_or_switch_changes_only_the_named_rule() {
        val ruleset = aRuleset(rules = listOf(aRule("a"), aRule("b", SiteTarget("other.example"))))

        val edited = RulesetEdits.setEnabled(RulesetEdits.setMode(ruleset, "b", RuleMode.BLOCK), "b", enabled = false)

        assertEquals(ruleset.rules[0], edited.rules[0])
        assertEquals(RuleMode.BLOCK to false, edited.rules[1].mode to edited.rules[1].enabled)
    }

    @Test
    fun allowing_a_community_adds_an_always_on_allow_rule_once() {
        val once = RulesetEdits.allowSubreddit(aRuleset(), "AskScience")
        val twice = RulesetEdits.allowSubreddit(once, "askscience")

        val added = once.rules.last()
        assertEquals("allow-reddit-r-askscience", added.id)
        assertEquals(SiteTarget("reddit.com", "/r/AskScience/**"), added.target)
        assertEquals(RuleMode.ALLOW, added.mode)
        assertSame(once, twice)
        assertEquals(listOf("AskScience"), RulesetEdits.allowedSubreddits(once).map { it.second })
        assertEquals(ValidationResult.Valid, RulesetCheck.of(RulesData.validator).check(once))
    }

    @Test
    fun a_taken_id_gets_a_numbered_suffix() {
        val taken = aRuleset(rules = listOf(aRule("allow-reddit-r-news")))

        assertEquals(
            "allow-reddit-r-news-2",
            RulesetEdits
                .allowSubreddit(taken, "news")
                .rules
                .last()
                .id,
        )
    }

    @Test
    fun only_allow_rules_on_a_reddit_community_count_as_allowed_communities() {
        val blocked = aRule("x", SiteTarget("reddit.com", "/r/news/**"), RuleMode.BLOCK)
        val elsewhere = aRule("y", SiteTarget("example.com", "/r/news/**"), RuleMode.ALLOW)
        val www = aRule("z", SiteTarget("www.reddit.com", "/r/news/**"), RuleMode.ALLOW)

        assertNull(RulesetEdits.allowedSubredditOf(blocked))
        assertNull(RulesetEdits.allowedSubredditOf(elsewhere))
        assertEquals("news", RulesetEdits.allowedSubredditOf(www))
    }

    @Test
    fun bedtime_and_work_hours_replace_their_part_only() {
        val ruleset = aRuleset()
        val bedtime = ruleset.bedtime.copy(start = "23:00")
        val hours = Schedule(listOf(Weekday.MON), "10:00", "16:00")

        val edited = RulesetEdits.setWorkHours(RulesetEdits.setBedtime(ruleset, bedtime), hours)

        assertEquals(ruleset.rules, edited.rules)
        assertEquals(bedtime, edited.bedtime)
        assertEquals(hours, edited.workHours)
    }

    @Test
    fun removing_a_rule_drops_it() {
        val ruleset = RulesetEdits.allowSubreddit(aRuleset(), "news")

        assertEquals(aRuleset().rules, RulesetEdits.removeRule(ruleset, "allow-reddit-r-news").rules)
    }
}
