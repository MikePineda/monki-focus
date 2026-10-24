// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.DecisionState
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test
import kotlin.random.Random

/**
 * Properties of `decide` over seeded random inputs (plain JUnit, no property
 * framework: a fixed seed per run index makes every failure reproducible and
 * the suite deterministic).
 */
class DecisionPropertiesTest {
    private val runs = 400
    private val catalog = RulesPackage.catalog

    private fun forAll(check: (seed: Int, DecisionArbitraries) -> Unit) {
        for (seed in 0 until runs) check(seed, DecisionArbitraries(Random(seed)))
    }

    @Test
    fun same_inputs_same_decision() {
        forAll { seed, arbitrary ->
            val ruleset = arbitrary.ruleset()
            val observation = arbitrary.observation()
            val state = arbitrary.decisionState()
            val now = arbitrary.instant()
            // A deep copy through JSON, like the TypeScript property's structuredClone.
            val rulesetCopy = RulesJson.decodeFromString(Ruleset.serializer(), RulesJson.encodeToString(Ruleset.serializer(), ruleset))
            val observationCopy =
                RulesJson.decodeFromString(Observation.serializer(), RulesJson.encodeToString(Observation.serializer(), observation))
            val stateCopy =
                RulesJson.decodeFromString(
                    DecisionState.serializer(),
                    RulesJson.encodeToString(DecisionState.serializer(), state),
                )

            val first = decide(ruleset, observation, state, now, catalog)
            val second = decide(rulesetCopy, observationCopy, stateCopy, now, catalog)

            assertEquals("seed $seed", first, second)
            assertEquals(
                "seed $seed: inputs untouched",
                Triple(rulesetCopy, observationCopy, stateCopy),
                Triple(ruleset, observation, state),
            )
        }
    }

    @Test
    fun decision_is_independent_of_rule_order() {
        forAll { seed, arbitrary ->
            val ruleset = arbitrary.ruleset()
            val reordered = ruleset.copy(rules = ruleset.rules.shuffled(Random(seed + runs)))
            val observation = arbitrary.observation()
            val state = arbitrary.decisionState()
            val now = arbitrary.instant()

            assertEquals(
                "seed $seed",
                decide(ruleset, observation, state, now, catalog),
                decide(reordered, observation, state, now, catalog),
            )
        }
    }

    @Test
    fun generated_inputs_reach_every_access_outcome() {
        // Guards the generators: a property over inputs that always allow would prove nothing.
        val outcomes = mutableSetOf<String>()
        forAll { seed, arbitrary ->
            val decision = decide(arbitrary.ruleset(), arbitrary.observation(), arbitrary.decisionState(), arbitrary.instant(), catalog)
            outcomes += "${decision.access}"
            assertNotEquals("seed $seed: valid inputs never fail closed", ReasonCode.ENGINE_ERROR, decision.reason)
        }

        assertEquals(setOf("ALLOW", "GATE", "BLOCK"), outcomes)
    }
}
