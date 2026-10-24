// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.nextEscalation
import dev.monkifocus.android.core.domain.rules.RulesJson
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §7: every `escalation` fixture; each step feeds the previous step's state. */
@RunWith(Parameterized::class)
class EscalationFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    @Test
    fun escalates_as_specified() {
        val case = RulesJson.decodeFromString(EscalationFixture.serializer(), fixture.text)
        var state = case.given.state
        case.steps.forEachIndexed { index, step ->
            val result = nextEscalation(state, step.event, step.at, case.given.guardianLinked)
            assertEquals("step $index (${step.event} at ${step.at})", step.then, result)
            state = result.state
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("escalation")
    }
}
