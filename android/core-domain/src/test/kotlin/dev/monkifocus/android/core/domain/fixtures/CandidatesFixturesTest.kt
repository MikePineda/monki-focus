// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.budgetedRulesFor
import dev.monkifocus.android.core.domain.engine.frictionCandidates
import dev.monkifocus.android.core.domain.rules.RulesJson
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §5.7: every `candidates` fixture, one test per fixture id. */
@RunWith(Parameterized::class)
class CandidatesFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun names_the_candidates_as_specified() {
        val case = RulesJson.decodeFromString(CandidatesFixture.serializer(), fixture.text)
        val (ruleset, now) = case.given
        val observation = case.whenever.target

        assertEquals(
            case.then,
            CandidatesFixture.Then(
                frictionCandidates = frictionCandidates(ruleset, observation, now, RulesPackage.catalog),
                budgetedRules = budgetedRulesFor(ruleset, observation, now, RulesPackage.catalog),
            ),
        )
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("candidates")
    }
}
