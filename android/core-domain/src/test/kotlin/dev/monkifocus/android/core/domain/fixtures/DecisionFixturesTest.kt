// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.decide
import dev.monkifocus.android.core.domain.rules.RulesJson
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §5: every `decision` and `specificity` fixture, one test per fixture id. */
@RunWith(Parameterized::class)
class DecisionFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun decides_as_specified() {
        val case = RulesJson.decodeFromString(DecisionFixture.serializer(), fixture.text)
        val (ruleset, now, state) = case.given

        assertEquals(case.then, decide(ruleset, case.whenever.target, state, now, RulesPackage.catalog))
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("decision", "specificity")
    }
}
