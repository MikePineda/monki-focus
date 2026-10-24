// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRule
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRuleset
import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.core.domain.rules.SiteTarget
import org.junit.Assert.assertEquals
import org.junit.Test

/** The adapter candidate helpers (SEMANTICS.md §5.7), the Kotlin twin of `AdapterCandidates.test.ts`. */
class AdapterCandidatesTest {
    private val now = "2026-10-26T10:00:00Z"
    private val page = SiteObservation("https://news.example.org/today")
    private val catalog = RulesPackage.catalog
    private val ruleset =
        aRuleset(
            rules =
                listOf(
                    aRule("r-news", RuleMode.FRICTION, SiteTarget("news.example.org"), dailyBudgetMinutes = 10),
                    aRule("r-other", RuleMode.ALLOW, SiteTarget("video.example.net"), dailyBudgetMinutes = 5),
                    aRule("r-off", RuleMode.ALLOW, dailyBudgetMinutes = 5, enabled = false),
                ),
        )

    @Test
    fun valid_inputs_name_the_matching_candidates() {
        assertEquals(listOf("r-news"), frictionCandidates(ruleset, page, now, catalog))
        assertEquals(listOf("r-news"), budgetedRulesFor(ruleset, page, now, catalog))
    }

    @Test
    fun an_instant_without_offset_gives_no_friction_candidates() {
        assertEquals(emptyList<String>(), frictionCandidates(ruleset, page, "2026-10-26T10:00:00", catalog))
    }

    @Test
    fun invalid_inputs_accrue_to_every_enabled_budget() {
        assertEquals(listOf("r-news", "r-other"), budgetedRulesFor(ruleset, SiteObservation(""), now, catalog))
        val lost = ruleset.copy(timeZone = "Mars/Olympus")
        assertEquals(listOf("r-news", "r-other"), budgetedRulesFor(lost, page, now, catalog))
        assertEquals(emptyList<String>(), frictionCandidates(lost, page, now, catalog))
    }

    @Test
    fun ids_are_in_code_unit_order() {
        val rules =
            listOf("r-b", "R-z", "r-a", "r-é").map { id -> aRule(id, RuleMode.FRICTION, SiteTarget("news.example.org"), 5) }

        assertEquals(listOf("R-z", "r-a", "r-b", "r-é"), frictionCandidates(aRuleset(rules), page, now, catalog))
        assertEquals(listOf("R-z", "r-a", "r-b", "r-é"), budgetedRulesFor(aRuleset(rules), page, now, catalog))
    }
}
