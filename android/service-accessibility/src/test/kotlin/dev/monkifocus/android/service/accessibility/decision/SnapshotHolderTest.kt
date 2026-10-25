// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.engine.initialEscalationState
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.support.MORNING_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.site
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SnapshotHolderTest {
    private val friction = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.FRICTION))

    @Test
    fun the_starter_preset_applies_while_the_stored_rules_load() {
        val holder = SnapshotHolder()

        holder.provisional(RulesData.starter)

        assertEquals(RulesData.starter, holder.snapshot?.ruleset)
        holder.loaded(friction)
        assertEquals(friction, holder.snapshot?.ruleset)
    }

    @Test
    fun a_rule_read_failing_before_any_stored_rules_fails_closed() {
        val holder = SnapshotHolder()
        holder.provisional(RulesData.starter)

        holder.failed()

        assertNull(holder.snapshot)
        assertTrue(holder.loadFailed)
    }

    @Test
    fun a_rule_read_failing_after_stored_rules_keeps_them() {
        val holder = SnapshotHolder()
        holder.loaded(friction)

        holder.failed()

        assertEquals(friction, holder.snapshot?.ruleset)
    }

    @Test
    fun until_the_escalation_is_read_friction_groups_start_at_level_two() {
        val holder = SnapshotHolder()
        holder.loaded(friction)

        assertEquals(listOf(ConservativeEscalation.of("reddit")), holder.snapshot?.escalation)
    }

    @Test
    fun escalation_that_cannot_be_read_stays_conservative_never_empty() {
        val holder = SnapshotHolder()
        holder.loaded(friction)

        holder.escalationUnavailable()

        assertEquals(
            ConservativeEscalation.ATTEMPTS,
            holder.snapshot
                ?.escalation
                ?.single()
                ?.attemptCount,
        )
    }

    @Test
    fun the_stored_escalation_replaces_the_conservative_start() {
        val holder = SnapshotHolder()
        holder.loaded(friction)

        holder.escalationLoaded(emptyList())

        assertEquals(emptyList<Any>(), holder.snapshot?.escalation)
    }

    @Test
    fun a_state_the_service_wrote_wins_over_a_late_storage_read() {
        val holder = SnapshotHolder()
        holder.loaded(friction)
        val written = initialEscalationState("reddit").copy(phase = EscalationPhase.ACTIVE, attemptCount = 7)
        holder.update(written)

        holder.escalationLoaded(listOf(initialEscalationState("reddit")))

        assertEquals(listOf(written), holder.snapshot?.escalation)
    }

    @Test
    fun the_first_gate_with_an_unknown_escalation_asks_for_a_typed_intention() {
        val h = PipelineHarness(ruleset = null)
        h.snapshots.loaded(friction)
        val evaluation =
            DecisionEvaluator(
                RulesData.catalog,
            ).evaluate(h.snapshots.snapshot, SiteObservation("https://www.reddit.com/"), null, MORNING_MS)

        h.coordinator.present(evaluation, "reddit.com", MORNING_MS)
        h.coordinator.tick(MORNING_MS + 61_000, onScreenGroup = "reddit")
        val shown = h.coordinator.presentGroup("reddit", evaluation.decision, "reddit.com", MORNING_MS + 61_000)

        assertTrue((shown as GateUiState.Asking).requiresTypedIntention)
    }
}
