// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.engine.ENGINE_ERROR_DECISION
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.ReasonCode
import org.junit.Assert.assertEquals
import org.junit.Test

class GateUiStateMapperTest {
    @Test
    fun an_allowed_decision_shows_nothing() {
        assertEquals(GateUiState.Hidden, GateUiStateMapper.map(anInput(anAllowDecision())))
    }

    @Test
    fun a_first_visit_without_stored_state_starts_the_full_pause() {
        val gate = aGate(level = 1, pauseSeconds = 15, frictionType = FrictionType.BREATH)

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate)))

        assertEquals(
            GateUiState.Pausing(TARGET, level = 1, frictionType = FrictionType.BREATH, pauseSeconds = 15, remainingSeconds = 15),
            state,
        )
    }

    @Test
    fun a_running_pause_counts_down_from_the_stored_end_time() {
        val gate = aGate(level = 1, pauseSeconds = 15)
        val escalation = anEscalation(EscalationPhase.PAUSING, gate, pauseEndsAt = nowPlus(12))

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation)) as GateUiState.Pausing

        assertEquals(12, state.remainingSeconds)
        assertEquals(3, state.elapsedSeconds)
        assertEquals(0.2f, state.progress, 0.0001f)
    }

    @Test
    fun a_pause_end_in_the_future_never_exceeds_the_pause_length() {
        val gate = aGate(pauseSeconds = 5)
        val escalation = anEscalation(EscalationPhase.PAUSING, gate, pauseEndsAt = nowPlus(500))

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation)) as GateUiState.Pausing

        assertEquals(5, state.remainingSeconds)
    }

    @Test
    fun a_finished_pause_shows_the_intention_prompt() {
        val gate = aGate(level = 2, pauseSeconds = 15)
        val escalation = anEscalation(EscalationPhase.PAUSING, gate, pauseEndsAt = nowPlus(-1))

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation, previousIntention = "reply to one message"))

        assertEquals(
            GateUiState.Asking(TARGET, level = 2, requiresTypedIntention = true, requiresGuardianKey = false, "reply to one message"),
            state,
        )
    }

    @Test
    fun a_finished_extension_pause_stays_on_the_pause_until_the_adapter_resumes() {
        val gate = aGate(level = 1, pauseSeconds = 30)
        val escalation = anEscalation(EscalationPhase.PAUSING, gate, pauseEndsAt = nowPlus(0), pendingExtension = true)

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation)) as GateUiState.Pausing

        assertEquals(0, state.remainingSeconds)
        assertEquals(1f, state.progress, 0f)
    }

    @Test
    fun the_asking_phase_carries_typing_and_guardian_requirements_of_the_gate() {
        val gate = aGate(level = 3, pauseSeconds = 15, requiresTypedIntention = true, requiresGuardianKey = true)
        val escalation = anEscalation(EscalationPhase.ASKING, gate)

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation, previousIntention = "  ")) as GateUiState.Asking

        assertEquals(3, state.level)
        assertEquals(true, state.requiresTypedIntention)
        assertEquals(true, state.requiresGuardianKey)
        assertEquals("a blank previous intention is no intention", null, state.previousIntention)
    }

    @Test
    fun a_timed_out_intention_offers_leave_or_five_more_minutes_with_the_doubled_pause() {
        val gate = aGate(level = 1, pauseSeconds = 15)
        val escalation = anEscalation(EscalationPhase.TIMED_OUT)

        val state =
            GateUiStateMapper.map(
                anInput(aGateDecision(gate), escalation, timedOutIntention = " reply to one message ", timedOutMinutes = 10),
            )

        assertEquals(
            GateUiState.Timeout(TARGET, "reply to one message", minutes = 10, extensionMinutes = 5, nextPauseSeconds = 30),
            state,
        )
    }

    @Test
    fun the_next_pause_after_a_timeout_is_capped_at_sixty_seconds() {
        val gate = aGate(level = 3, pauseSeconds = 60)

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), anEscalation(EscalationPhase.TIMED_OUT))) as GateUiState.Timeout

        assertEquals(60, state.nextPauseSeconds)
        assertEquals(null, state.intention)
        assertEquals(null, state.minutes)
    }

    @Test
    fun the_emergency_wait_counts_down_two_minutes_from_the_ready_time() {
        val escalation = anEscalation(EscalationPhase.OVERRIDE_WAITING, overrideReadyAt = nowPlus(107))

        val state = GateUiStateMapper.map(anInput(aGateDecision(), escalation, guardianLinked = true)) as GateUiState.EmergencyWait

        assertEquals(107, state.remainingSeconds)
        assertEquals(120, state.waitSeconds)
        assertEquals(true, state.guardianLinked)
    }

    @Test
    fun an_emergency_wait_over_a_block_is_shown_too() {
        val escalation = anEscalation(EscalationPhase.OVERRIDE_WAITING, overrideReadyAt = nowPlus(120))
        val decision = aBlockDecision(ReasonCode.BUDGET_EXHAUSTED, ExplanationKey.BUDGET_EXHAUSTED)

        val state = GateUiStateMapper.map(anInput(decision, escalation))

        assertEquals(GateUiState.EmergencyWait(TARGET, remainingSeconds = 120, guardianLinked = false), state)
    }

    @Test
    fun a_spent_budget_blocks_with_close_and_emergency() {
        val decision = aBlockDecision(ReasonCode.BUDGET_EXHAUSTED, ExplanationKey.BUDGET_EXHAUSTED)

        assertEquals(
            GateUiState.Blocked(TARGET, ExplanationKey.BUDGET_EXHAUSTED, emergencyAvailable = true),
            GateUiStateMapper.map(anInput(decision)),
        )
    }

    @Test
    fun a_block_rule_blocks_with_close_and_emergency() {
        val decision = aBlockDecision(ReasonCode.RULE_MATCH, ExplanationKey.BLOCKED_BY_RULE)

        assertEquals(
            GateUiState.Blocked(TARGET, ExplanationKey.BLOCKED_BY_RULE, emergencyAvailable = true),
            GateUiStateMapper.map(anInput(decision)),
        )
    }

    @Test
    fun bedtime_shows_the_bedtime_cover_until_the_window_ends() {
        val decision = aBlockDecision(ReasonCode.SCHEDULE_BEDTIME, ExplanationKey.SCHEDULE_BEDTIME)

        assertEquals(GateUiState.BedtimeCover(endMinuteOfDay = 420), GateUiStateMapper.map(anInput(decision, bedtimeEndMinuteOfDay = 420)))
        assertEquals(
            GateUiState.BedtimeCover(endMinuteOfDay = null),
            GateUiStateMapper.map(anInput(decision, bedtimeEndMinuteOfDay = 2000)),
        )
    }

    @Test
    fun an_engine_error_fails_closed_without_emergency() {
        assertEquals(
            GateUiState.Blocked(TARGET, ExplanationKey.ENGINE_ERROR, emergencyAvailable = false),
            GateUiStateMapper.map(anInput(ENGINE_ERROR_DECISION)),
        )
    }

    @Test
    fun a_gate_decision_without_a_gate_fails_closed() {
        assertEquals(
            GateUiState.Blocked(TARGET, ExplanationKey.ENGINE_ERROR, emergencyAvailable = false),
            GateUiStateMapper.map(anInput(aGateDecision(gate = null))),
        )
    }

    @Test
    fun an_unreadable_stored_instant_falls_back_to_the_full_pause() {
        val gate = aGate(pauseSeconds = 5)
        val escalation = anEscalation(EscalationPhase.PAUSING, gate, pauseEndsAt = "not an instant")

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), escalation)) as GateUiState.Pausing

        assertEquals(5, state.remainingSeconds)
    }

    @Test
    fun an_intention_that_ran_out_starts_a_new_pause_on_the_next_visit() {
        val gate = aGate(level = 1, pauseSeconds = 15)

        val state = GateUiStateMapper.map(anInput(aGateDecision(gate), anEscalation(EscalationPhase.ACTIVE))) as GateUiState.Pausing

        assertEquals(15, state.remainingSeconds)
    }
}
