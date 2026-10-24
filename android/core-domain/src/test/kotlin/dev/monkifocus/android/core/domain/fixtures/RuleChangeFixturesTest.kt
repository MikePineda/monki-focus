// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.effectiveRuleSet
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §8: every `rule-change` fixture; rules compare as a set keyed by id. */
@RunWith(Parameterized::class)
class RuleChangeFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    private fun rulesAsSet(ruleset: Ruleset): Ruleset = ruleset.copy(rules = ruleset.rules.sortedBy { it.id })

    @Test
    fun changes_as_specified() {
        val case = RulesJson.decodeFromString(RuleChangeFixture.serializer(), fixture.text)
        val (old, new, now, pendingEffectiveFrom) = case.given

        val result = effectiveRuleSet(old, new, now, pendingEffectiveFrom, RulesPackage.catalog)

        assertEquals(case.then.effectiveFrom, result.effectiveFrom)
        assertEquals(rulesAsSet(case.then.effectiveToday), rulesAsSet(result.effectiveToday))
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("rule-change")
    }
}
