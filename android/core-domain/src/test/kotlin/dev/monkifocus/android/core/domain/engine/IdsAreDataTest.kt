// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRule
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRuleset
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aState
import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.DailyUsage
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SiteTarget
import org.junit.Assert.assertEquals
import org.junit.Test

/** SEMANTICS.md §14: rule ids, target groups and usage keys are data, so object-member names are plain ids. */
class IdsAreDataTest {
    private val memberIds = listOf("constructor", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf", "proto__", "hashCode", "equals")
    private val now = "2026-10-26T10:00:00Z"
    private val page = SiteObservation("https://news.example.org/today")
    private val catalog = RulesPackage.catalog

    private fun budgeted(id: String) = aRule(id, RuleMode.ALLOW, SiteTarget("news.example.org"), dailyBudgetMinutes = 10)

    @Test
    fun prototype_like_rule_ids_without_usage_are_not_exhausted() {
        memberIds.forEach { id ->
            val state = aState().copy(usage = DailyUsage("2026-10-26", emptyMap()))
            val decision = decide(aRuleset(listOf(budgeted(id))), page, state, now, catalog)

            assertEquals(id, Access.ALLOW, decision.access)
            assertEquals(id, ReasonCode.RULE_MATCH, decision.reason)
            assertEquals(id, id, decision.ruleId)
        }
    }

    @Test
    fun prototype_like_rule_ids_with_spent_usage_are_exhausted() {
        memberIds.forEach { id ->
            val state = aState().copy(usage = DailyUsage("2026-10-26", mapOf(id to 600)))
            val decision = decide(aRuleset(listOf(budgeted(id))), page, state, now, catalog)

            assertEquals(id, Access.BLOCK, decision.access)
            assertEquals(id, ReasonCode.BUDGET_EXHAUSTED, decision.reason)
            assertEquals(id, id, decision.ruleId)
        }
    }

    @Test
    fun a_prototype_like_escalation_group_is_its_own_state() {
        memberIds.forEach { id ->
            val friction = aRule(id, RuleMode.FRICTION, SiteTarget("news.example.org"))
            val active = initialEscalationState(id).copy(phase = EscalationPhase.ACTIVE, intentionExpiresAt = "2026-10-26T10:05:00Z")
            val decision = decide(aRuleset(listOf(friction)), page, aState().copy(escalation = listOf(active)), now, catalog)

            assertEquals(id, ReasonCode.INTENTION_ACTIVE, decision.reason)
            assertEquals(id, id, decision.ruleId)
        }
    }

    @Test
    fun an_alias_named_like_a_prototype_member_is_an_ordinary_alias() {
        val profile = SiteProfile(1, "video.example", listOf("constructor.example"), "history", emptyMap())
        val synthetic = RulesCatalog(listOf(profile), emptyList(), emptyList())

        assertEquals("video.example", synthetic.normaliseDomain("www.constructor.example"))
        assertEquals("tostring.example", synthetic.normaliseDomain("tostring.example"))
    }
}
