// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.decide
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.RulesJson
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-implementation parity: the Kotlin `decide` returns, for every
 * `decision` and `specificity` fixture, exactly the `Decision` the TypeScript engine is checked
 * against. Compared field by field and as JSON (so an absent `gate` must be
 * absent and no field can be left out), never partially.
 */
class DecisionParityTest {
    @Test
    fun every_decision_and_specificity_fixture_matches_then_field_by_field() {
        val fixtures = listOf("decision", "specificity").flatMap { FixtureLoader.load(it) }
        val mismatches =
            fixtures.flatMap { fixture ->
                val case = RulesJson.decodeFromString(DecisionFixture.serializer(), fixture.text)
                val decision = decide(case.given.ruleset, case.whenever.target, case.given.state, case.given.now, RulesPackage.catalog)
                fieldMismatches(case.then, decision).map { "${fixture.id}: $it" } +
                    jsonMismatch(fixture.json.getValue("then").jsonObject, decision).map { "${fixture.id}: $it" }
            }

        assertTrue("has at least one decision fixture", fixtures.isNotEmpty())
        assertEquals("Every decision fixture matches", emptyList<String>(), mismatches)
    }

    private fun fieldMismatches(
        expected: Decision,
        actual: Decision,
    ): List<String> =
        listOfNotNull(
            "access".takeIf { expected.access != actual.access },
            "content".takeIf { expected.content != actual.content },
            "ruleId".takeIf { expected.ruleId != actual.ruleId },
            "reason".takeIf { expected.reason != actual.reason },
            "gate".takeIf { expected.gate != actual.gate },
            "explanationKey".takeIf { expected.explanationKey != actual.explanationKey },
            "validUntil".takeIf { expected.validUntil != actual.validUntil },
        )

    private fun jsonMismatch(
        expected: JsonObject,
        actual: Decision,
    ): List<String> {
        val encoded = RulesJson.encodeToJsonElement(Decision.serializer(), actual).jsonObject
        return if (encoded == expected) emptyList() else listOf("json $encoded != $expected")
    }
}
