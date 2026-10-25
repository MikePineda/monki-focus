// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.BEDTIME_GROUP
import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.decision.DecisionEvaluator
import dev.monkifocus.android.service.accessibility.support.BEDTIME_ON
import dev.monkifocus.android.service.accessibility.support.MORNING_MS
import dev.monkifocus.android.service.accessibility.support.NIGHT_MS
import dev.monkifocus.android.service.accessibility.support.PipelineHarness
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.aRule
import dev.monkifocus.android.service.accessibility.support.aRuleset
import dev.monkifocus.android.service.accessibility.support.site
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GateCoordinatorTest {
    private val friction = aRuleset(aRule("reddit", site("reddit.com"), RuleMode.FRICTION))
    private val page = SiteObservation("https://www.reddit.com/")

    private fun PipelineHarness.gateAt(
        nowMs: Long,
        observation: SiteObservation = page,
    ): GateUiState {
        val evaluation = DecisionEvaluator(RulesData.catalog).evaluate(snapshots.snapshot, observation, null, nowMs)
        return coordinator.present(evaluation, "reddit.com", nowMs)
    }

    /** Visits [times] times (closing each gate but the last) and waits out the last pause. */
    private fun PipelineHarness.askingAfter(times: Int): Long {
        var now = MORNING_MS
        repeat(times - 1) {
            gateAt(now)
            coordinator.close("reddit", now)
            now += 1_000
        }
        gateAt(now)
        now += 61_000
        coordinator.tick(now, onScreenGroup = "reddit")
        return now
    }

    @Test
    fun every_escalation_step_is_persisted() {
        val h = PipelineHarness(friction)

        h.gateAt(MORNING_MS)

        assertEquals(listOf(EscalationPhase.PAUSING), h.escalationWrites.map { it.phase })
    }

    @Test
    fun a_typed_intention_needs_three_words_that_differ_from_last_time() {
        val h = PipelineHarness(friction)
        val now = h.askingAfter(3)

        assertEquals(CommitResult.TOO_FEW_WORDS, h.coordinator.commit("reddit", "just looking", 10, now))
        assertEquals(CommitResult.ACCEPTED, h.coordinator.commit("reddit", "read one thread only", 10, now))
        h.coordinator.leave("reddit", now + 1_000)
        h.gateAt(now + 2_000)
        val again = now + 2_000 + 61_000
        h.coordinator.tick(again, onScreenGroup = "reddit")

        assertEquals(EscalationPhase.ASKING, h.phaseOf("reddit"))
        assertEquals(CommitResult.SAME_AS_LAST, h.coordinator.commit("reddit", " Read one thread ONLY ", 10, again))
    }

    @Test
    fun the_engine_and_the_store_only_ever_see_the_word_count() {
        val h = PipelineHarness(friction)
        val now = h.askingAfter(1)

        h.coordinator.commit("reddit", "reply to one message", 5, now)

        assertEquals(listOf("started:reddit:5:4"), h.intentions.entries)
        assertTrue(h.escalationWrites.none { "message" in it.toString() })
    }

    @Test
    fun an_intention_that_runs_out_off_screen_was_kept() {
        val h = PipelineHarness(friction)
        val now = h.askingAfter(1)
        h.coordinator.commit("reddit", "", 5, now)

        h.coordinator.tick(now + 5 * 60_000, onScreenGroup = null)

        assertEquals(EscalationPhase.IDLE, h.phaseOf("reddit"))
        assertEquals("ended:reddit:kept", h.intentions.entries.last())
    }

    @Test
    fun extending_after_a_timeout_counts_as_broken() {
        val h = PipelineHarness(friction)
        val now = h.askingAfter(1)
        h.coordinator.commit("reddit", "", 5, now)
        h.coordinator.tick(now + 5 * 60_000, onScreenGroup = "reddit")

        h.coordinator.extend("reddit", now + 5 * 60_000 + 1_000)

        assertEquals("ended:reddit:broken", h.intentions.entries.last())
        assertEquals(EscalationPhase.PAUSING, h.phaseOf("reddit"))
    }

    @Test
    fun a_wall_clock_set_back_ends_a_running_intention() {
        val h = PipelineHarness(friction)
        val now = h.askingAfter(1)
        h.coordinator.commit("reddit", "", 15, now)

        h.coordinator.tick(now - 3_600_000, onScreenGroup = "reddit")

        assertEquals(EscalationPhase.IDLE, h.phaseOf("reddit"))
    }

    @Test
    fun emergency_access_at_bedtime_uses_the_bedtime_group() {
        val h = PipelineHarness(aRuleset(bedtime = BEDTIME_ON), startWallMs = NIGHT_MS)
        val instagram = AppObservation("com.instagram.android", null)
        val evaluation = DecisionEvaluator(RulesData.catalog).evaluate(h.snapshots.snapshot, instagram, null, NIGHT_MS)
        assertTrue(h.coordinator.present(evaluation, "app", NIGHT_MS) is GateUiState.BedtimeCover)

        h.coordinator.emergency(BEDTIME_GROUP, NIGHT_MS)
        h.coordinator.tick(NIGHT_MS + 120_000, onScreenGroup = BEDTIME_GROUP)

        assertEquals(EscalationPhase.OVERRIDE_ACTIVE, h.phaseOf(BEDTIME_GROUP))
        assertEquals("bedtime", h.bypassEvents.single().details["scope"])
    }
}
