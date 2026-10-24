// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.fixtures

import dev.monkifocus.android.core.domain.engine.budgetedRulesFor
import dev.monkifocus.android.core.domain.engine.decide
import dev.monkifocus.android.core.domain.engine.effectiveEscalationState
import dev.monkifocus.android.core.domain.engine.frictionCandidates
import dev.monkifocus.android.core.domain.engine.nextEscalation
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.EscalationEvent
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ReasonCode
import dev.monkifocus.android.core.domain.rules.RulesJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** SEMANTICS.md §5: every `decision` and `specificity` fixture, one test per fixture id. */
@RunWith(Parameterized::class)
class DecisionFixturesTest(
    @Suppress("unused") private val id: String,
    private val fixture: Fixture,
) {
    private val case by lazy { RulesJson.decodeFromString(DecisionFixture.serializer(), fixture.text) }

    @Test
    fun decides_as_specified() {
        val (ruleset, now, state) = case.given

        assertEquals(case.then, decide(ruleset, case.whenever.target, state, now, RulesPackage.catalog))
    }

    /**
     * The adapter contract of §7.4 and §5.2.2, checked on every decision: the
     * friction candidates name the gating winner and, combined with
     * `effectiveEscalationState`, make `nextEscalation` store exactly the gate
     * `decide` returned; a spent budget belongs to a rule the activity accrues to.
     */
    @Test
    fun adapter_helpers_agree_with_the_decision() {
        val (ruleset, now, state) = case.given
        val observation = case.whenever.target
        val then = case.then
        val catalog = RulesPackage.catalog
        if (then.reason == ReasonCode.BUDGET_EXHAUSTED && then.ruleId != null) {
            assertTrue(then.ruleId in budgetedRulesFor(ruleset, observation, now, catalog))
        }
        val ruleId = then.ruleId
        if (then.access != Access.GATE || ruleId == null) return
        val ids = frictionCandidates(ruleset, observation, now, catalog)
        assertTrue("$ruleId in $ids", ruleId in ids)
        val byId = ruleset.rules.associateBy { it.id }
        val winner = byId.getValue(ruleId)
        val own = state.escalation.find { it.targetGroup == winner.id }
        if (own != null && own.phase in STORED_GATE_PHASES) return
        val effective = effectiveEscalationState(winner, ids.map(byId::getValue), state.escalation, now)
        val visited = nextEscalation(effective, EscalationEvent.Visit, now, state.guardianLinked)

        assertEquals(then.gate, visited.state.gate)
    }

    companion object {
        /** Phases in which `decide` shows the stored gate instead of the one a visit would produce (§7.4). */
        private val STORED_GATE_PHASES =
            setOf(EscalationPhase.PAUSING, EscalationPhase.ASKING, EscalationPhase.TIMED_OUT, EscalationPhase.OVERRIDE_WAITING)

        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun fixtures(): List<Array<Any>> = FixtureLoader.parameters("decision", "specificity")
    }
}
