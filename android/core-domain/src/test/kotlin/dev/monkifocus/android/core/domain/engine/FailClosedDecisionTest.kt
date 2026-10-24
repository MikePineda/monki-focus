// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRule
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aRuleset
import dev.monkifocus.android.core.domain.engine.RulesetFactory.aState
import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.core.domain.rules.SiteTarget
import dev.monkifocus.android.core.domain.rules.VerifiedUnlock
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/** SEMANTICS.md §14: any exception or invalid input blocks, hides the feed and says `engine_error`. */
class FailClosedDecisionTest {
    private val now = "2026-10-26T10:00:00Z"
    private val page = SiteObservation("https://news.example.org/today")
    private val catalog = RulesPackage.catalog

    private fun assertFailsClosed(decision: dev.monkifocus.android.core.domain.rules.Decision) {
        assertEquals(Access.BLOCK, decision.access)
        assertEquals(Content.HIDE_FEED, decision.content)
        assertNull(decision.ruleId)
        assertEquals(ReasonCode.ENGINE_ERROR, decision.reason)
        assertEquals(ExplanationKey.ENGINE_ERROR, decision.explanationKey)
        assertNull(decision.gate)
        assertNull(decision.validUntil)
        assertEquals(ENGINE_ERROR_DECISION, decision)
    }

    @Test
    fun garbage_url_text_fails_closed() {
        // Kotlin's types rule out a missing or non-text urlText; text that fails its schema is the garbage left.
        listOf("", "x".repeat(2049)).forEach { urlText ->
            assertFailsClosed(decide(aRuleset(), SiteObservation(urlText), aState(), now, catalog))
        }
        assertFailsClosed(decide(aRuleset(), AppObservation("not a package", null), aState(), now, catalog))
        assertFailsClosed(decide(aRuleset(), AppObservation("com.example.reader", "Not A Surface"), aState(), now, catalog))
    }

    @Test
    fun instant_without_offset_fails_closed() {
        assertFailsClosed(decide(aRuleset(), page, aState(), "2026-10-26T10:00:00", catalog))
        val unlock = VerifiedUnlock(SiteTarget("news.example.org"), notBefore = "2026-10-26 09:00", expiresAt = now)
        val ruleset = aRuleset(rules = listOf(aRule("r", target = SiteTarget("news.example.org"))))
        assertFailsClosed(decide(ruleset, page, aState().copy(unlocks = listOf(unlock)), now, catalog))
    }

    @Test
    fun invalid_state_instants_fail_closed_even_when_no_rule_reads_them() {
        val unlock = VerifiedUnlock(SiteTarget("news.example.org"), notBefore = now, expiresAt = "later")
        assertFailsClosed(decide(aRuleset(), page, aState().copy(unlocks = listOf(unlock)), now, catalog))
        val escalation = initialEscalationState("r-x").copy(lastActivityAt = "2026-10-26T09:00:00")
        assertFailsClosed(decide(aRuleset(), page, aState().copy(escalation = listOf(escalation)), now, catalog))
        assertFailsClosed(decide(aRuleset(), page, aState().copy(pendingEffectiveFrom = "tomorrow"), now, catalog))
    }

    @Test
    fun unknown_time_zone_fails_closed() {
        assertFailsClosed(decide(aRuleset(timeZone = "Mars/Olympus"), page, aState(), now, catalog))
        assertFailsClosed(decide(aRuleset(pendingTimeZone = "Mars/Olympus"), page, aState(), now, catalog))
    }

    @Test
    fun the_core_throws_so_tests_see_the_error() {
        assertThrows(InvalidInstantException::class.java) { decideOrThrow(aRuleset(), page, aState(), "2026-10-26T10:00:00", catalog) }
        assertThrows(
            UnknownTimeZoneException::class.java,
        ) { decideOrThrow(aRuleset(timeZone = "Mars/Olympus"), page, aState(), now, catalog) }
    }

    @Test
    fun valid_input_decides_normally() {
        val decision = decide(aRuleset(), page, aState(), now, catalog)

        assertEquals(Access.ALLOW, decision.access)
        assertEquals(ReasonCode.NO_RULE, decision.reason)
    }

    @Test
    fun the_run_time_zone_lookup_ignores_case_like_intl() {
        // Validators reject `utc` (x-timeZone is case-sensitive); at run time it resolves as in the TypeScript engine.
        assertEquals(ReasonCode.NO_RULE, decide(aRuleset(timeZone = "australia/sydney"), page, aState(), now, catalog).reason)
    }
}
