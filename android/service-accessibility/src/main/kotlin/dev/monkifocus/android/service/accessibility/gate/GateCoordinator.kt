// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.gate

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.effectiveEscalationState
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.initialEscalationState
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.engine.nextEscalation
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.EscalationEffect
import dev.monkifocus.android.core.domain.rules.EscalationEvent
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.feature.gate.state.GateInput
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.feature.gate.state.GateUiStateMapper
import dev.monkifocus.android.service.accessibility.bypass.BypassKind
import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder
import dev.monkifocus.android.service.accessibility.decision.Evaluation
import dev.monkifocus.android.service.accessibility.decision.SnapshotHolder

/**
 * The service's side of the friction gate, a port of the extension's
 * `GateController`: every state and transition is the engine's. `decide`
 * says whether a target is gated, blocked or lifted and by which group;
 * `effectiveEscalationState` + `nextEscalation` move the group's state
 * (SEMANTICS.md §7); this class only keeps the result in the snapshot,
 * persists it, records the day's intentions and the emergency bypass, and
 * maps the state to what the gate shows ([GateUiStateMapper]).
 *
 * The typed intention text stays in memory (for "different from last time"
 * and the timeout card); only its word count reaches the engine and the
 * store. Main thread only; the wall clock is a parameter.
 */
class GateCoordinator(
    private val catalog: RulesCatalog,
    private val snapshots: SnapshotHolder,
    private val sink: EscalationSink,
    private val intentions: IntentionLog,
    private val bypasses: BypassRecorder,
) {
    private data class Typed(
        val text: String,
        val minutes: Int,
    )

    private val lastTyped = HashMap<String, Typed>()

    fun stateOf(group: String): EscalationState =
        snapshots.snapshot
            ?.escalation
            ?.firstOrNull { it.targetGroup == group }
            ?: initialEscalationState(group)

    private val guardianLinked: Boolean get() = snapshots.snapshot?.guardianLinked == true

    /**
     * What the gate shows for [evaluation] at [nowEpochMs]. A friction gate
     * outside a running pause or prompt records the visit first, on the
     * effective state of every matching friction group (§7.4), so the stored
     * gate equals the one `decide` returned.
     */
    fun present(
        evaluation: Evaluation,
        targetLabel: String,
        nowEpochMs: Long,
    ): GateUiState {
        val decision = evaluation.decision
        if (decision.access == Access.ALLOW) return GateUiState.Hidden
        val group = GateGroup.of(decision) ?: return map(decision, null, targetLabel, nowEpochMs)
        if (decision.access == Access.GATE && stateOf(group).phase !in VISIT_IGNORED) visit(evaluation, group, nowEpochMs)
        return presentGroup(group, decision, targetLabel, nowEpochMs)
    }

    /** What the gate of [group] shows now, from its stored state and the decision that put it on screen. */
    fun presentGroup(
        group: String,
        decision: Decision,
        targetLabel: String,
        nowEpochMs: Long,
    ): GateUiState {
        val state = stateOf(group)
        return when (state.phase) {
            EscalationPhase.TIMED_OUT -> {
                timeout(group, state, targetLabel, nowEpochMs)
            }

            EscalationPhase.ACTIVE, EscalationPhase.OVERRIDE_ACTIVE -> {
                GateUiState.Hidden
            }

            EscalationPhase.IDLE -> {
                if (decision.access ==
                    Access.BLOCK
                ) {
                    map(decision, state, targetLabel, nowEpochMs)
                } else {
                    GateUiState.Hidden
                }
            }

            EscalationPhase.PAUSING, EscalationPhase.ASKING, EscalationPhase.OVERRIDE_WAITING -> {
                val gated = if (decision.access == Access.GATE) decision.copy(gate = state.gate ?: decision.gate) else decision
                map(gated, state, targetLabel, nowEpochMs)
            }
        }
    }

    fun commit(
        group: String,
        intention: String,
        minutes: Int,
        nowEpochMs: Long,
    ): CommitResult {
        val state = stateOf(group)
        if (state.phase != EscalationPhase.ASKING) return CommitResult.NOT_ASKING
        val text = intention.trim()
        val words = IntentionWords.count(text)
        if (state.gate?.requiresTypedIntention == true) {
            if (words < MIN_TYPED_WORDS) return CommitResult.TOO_FEW_WORDS
            if (IntentionWords.repeats(text, lastTyped[group]?.text)) return CommitResult.SAME_AS_LAST
        }
        val next =
            step(group, EscalationEvent.Commit(minutes, words, guardianKeyVerified = false), nowEpochMs) ?: return CommitResult.NOT_ASKING
        if (next.phase != EscalationPhase.ACTIVE) return CommitResult.NOT_ASKING
        lastTyped[group] = Typed(text, minutes)
        intentions.started(group, minutes, words, instantOf(nowEpochMs), next.intentionExpiresAt ?: instantOf(nowEpochMs))
        return CommitResult.ACCEPTED
    }

    /** Close (and Leave on the timeout card). */
    fun close(
        group: String,
        nowEpochMs: Long,
    ) {
        if (stateOf(group).phase == EscalationPhase.TIMED_OUT) {
            leave(group, nowEpochMs)
        } else {
            step(group, EscalationEvent.Close, nowEpochMs)
        }
    }

    fun leave(
        group: String,
        nowEpochMs: Long,
    ) {
        if (step(group, EscalationEvent.Leave, nowEpochMs) != null) intentions.ended(group, IntentionOutcome.KEPT, instantOf(nowEpochMs))
    }

    fun extend(
        group: String,
        nowEpochMs: Long,
    ) {
        if (step(group, EscalationEvent.Extend, nowEpochMs) != null) intentions.ended(group, IntentionOutcome.BROKEN, instantOf(nowEpochMs))
    }

    fun emergency(
        group: String,
        nowEpochMs: Long,
    ) {
        step(group, EscalationEvent.EmergencyRequest, nowEpochMs)
    }

    fun cancelEmergency(
        group: String,
        nowEpochMs: Long,
    ) {
        if (stateOf(group).phase == EscalationPhase.OVERRIDE_WAITING) step(group, EscalationEvent.Close, nowEpochMs)
    }

    /**
     * Moves every timer that ran out: pauses, emergency waits (always
     * granted and always recorded), intentions (an intention that runs out
     * while [onScreenGroup] is something else is kept: the user left in
     * time) and overrides. A wall clock rewound behind the last escalation
     * event ends the lifts measured on it. Answers the groups that changed.
     */
    fun tick(
        nowEpochMs: Long,
        onScreenGroup: String?,
    ): Set<String> {
        val changed = endRewoundLifts(nowEpochMs).toMutableSet()
        val nowSeconds = Math.floorDiv(nowEpochMs, MILLIS_PER_SECOND)
        for (state in snapshots.snapshot?.escalation.orEmpty()) {
            val group = state.targetGroup
            val event =
                when {
                    state.phase == EscalationPhase.PAUSING && passed(state.pauseEndsAt, nowSeconds) -> EscalationEvent.PauseElapsed

                    state.phase == EscalationPhase.OVERRIDE_WAITING &&
                        passed(
                            state.overrideReadyAt,
                            nowSeconds,
                        )
                    -> EscalationEvent.EmergencyWaitElapsed

                    state.phase == EscalationPhase.ACTIVE &&
                        passed(
                            state.intentionExpiresAt,
                            nowSeconds,
                        )
                    -> EscalationEvent.IntentionExpired

                    state.phase == EscalationPhase.OVERRIDE_ACTIVE &&
                        passed(
                            state.overrideEndsAt,
                            nowSeconds,
                        )
                    -> EscalationEvent.EmergencyExpired

                    else -> null
                } ?: continue
            if (step(group, event, nowEpochMs) == null) continue
            changed += group
            if (event == EscalationEvent.IntentionExpired && group != onScreenGroup) leave(group, nowEpochMs)
        }
        return changed
    }

    /** True while some group has a timer running, so the service keeps ticking even with nothing on screen. */
    fun hasRunningTimers(): Boolean =
        snapshots.snapshot
            ?.escalation
            .orEmpty()
            .any { it.phase in TIMED_PHASES }

    private fun visit(
        evaluation: Evaluation,
        group: String,
        nowEpochMs: Long,
    ) {
        val ruleset = evaluation.ruleset ?: return
        val winner = ruleset.rules.firstOrNull { it.id == group } ?: return
        val now = instantOf(nowEpochMs)
        val states = snapshots.snapshot?.escalation.orEmpty()
        val candidates = FrictionCandidates.of(ruleset, evaluation.observation, now, catalog)
        val effective = effectiveEscalationState(winner, candidates, states, now)
        val result = nextEscalation(effective, EscalationEvent.Visit, now, guardianLinked)
        if (result.state != effective) store(result.state)
    }

    /** Applies [event] to [group]'s state; answers the new state, or null when nothing changed. */
    private fun step(
        group: String,
        event: EscalationEvent,
        nowEpochMs: Long,
    ): EscalationState? {
        val before = stateOf(group)
        val result = nextEscalation(before, event, instantOf(nowEpochMs), guardianLinked)
        if (result.state == before) return null
        if (EscalationEffect.RECORD_BYPASS in result.effects) recordOverride(before, result.state, nowEpochMs)
        store(result.state)
        return result.state
    }

    private fun recordOverride(
        before: EscalationState,
        after: EscalationState,
        nowEpochMs: Long,
    ) {
        val details =
            buildMap {
                put("target_group", after.targetGroup)
                before.overrideReadyAt?.let { put("wait_ended_at", it) }
                after.overrideEndsAt?.let { put("ends_at", it) }
            }
        bypasses.record(BypassKind.EMERGENCY_OVERRIDE, nowEpochMs, details = details)
    }

    private fun store(state: EscalationState) {
        snapshots.update(state)
        sink.persist(state)
    }

    /**
     * The wall clock went back behind a group's last escalation event: an
     * intention ends (the engine's `leave`) and an override returns to idle
     * with its counters kept. Fails toward friction.
     */
    private fun endRewoundLifts(nowEpochMs: Long): Set<String> {
        val nowSeconds = Math.floorDiv(nowEpochMs, MILLIS_PER_SECOND)
        val changed = mutableSetOf<String>()
        for (state in snapshots.snapshot?.escalation.orEmpty()) {
            val last = state.lastActivityAt?.let(::epochSecondsOf) ?: continue
            if (last <= nowSeconds) continue
            when (state.phase) {
                EscalationPhase.ACTIVE -> {
                    leave(state.targetGroup, nowEpochMs)
                    changed += state.targetGroup
                }

                EscalationPhase.OVERRIDE_ACTIVE -> {
                    store(
                        initialEscalationState(state.targetGroup).copy(
                            attemptCount = state.attemptCount,
                            brokenCount = state.brokenCount,
                            lastAttemptAt = state.lastAttemptAt,
                            lastFrictionType = state.lastFrictionType,
                            lastActivityAt = instantOf(nowEpochMs),
                        ),
                    )
                    changed += state.targetGroup
                }

                else -> {
                    Unit
                }
            }
        }
        return changed
    }

    private fun timeout(
        group: String,
        state: EscalationState,
        targetLabel: String,
        nowEpochMs: Long,
    ): GateUiState {
        val typed = lastTyped[group]
        val extended = nextEscalation(state, EscalationEvent.Extend, instantOf(nowEpochMs), guardianLinked).state
        return GateUiState.Timeout(
            targetLabel = targetLabel,
            intention = typed?.text?.takeIf { it.isNotEmpty() },
            minutes = typed?.minutes,
            extensionMinutes = GateUiStateMapper.EXTENSION_MINUTES,
            nextPauseSeconds = extended.gate?.pauseSeconds ?: 0,
        )
    }

    private fun map(
        decision: Decision,
        state: EscalationState?,
        targetLabel: String,
        nowEpochMs: Long,
    ): GateUiState =
        GateUiStateMapper.map(
            GateInput(
                decision = decision,
                escalation = state,
                nowEpochSeconds = Math.floorDiv(nowEpochMs, MILLIS_PER_SECOND),
                targetLabel = targetLabel,
                guardianLinked = guardianLinked,
                previousIntention = state?.targetGroup?.let { lastTyped[it]?.text },
                bedtimeEndMinuteOfDay = bedtimeEndMinute(),
            ),
        )

    private fun bedtimeEndMinute(): Int? {
        val bedtime = snapshots.snapshot?.ruleset?.bedtime ?: return null
        if (!bedtime.enabled) return null
        return runCatching { bedtime.end.substring(0, 2).toInt() * MINUTES_PER_HOUR + bedtime.end.substring(3, 5).toInt() }.getOrNull()
    }

    private fun passed(
        instant: String?,
        nowSeconds: Long,
    ): Boolean = instant == null || runCatching { nowSeconds >= epochSecondsOf(instant) }.getOrDefault(true)

    private companion object {
        /** Phases in which a `visit` changes nothing (§7.3), so `present` does not send one. */
        val VISIT_IGNORED =
            setOf(EscalationPhase.PAUSING, EscalationPhase.ASKING, EscalationPhase.TIMED_OUT, EscalationPhase.OVERRIDE_WAITING)
        val TIMED_PHASES =
            setOf(EscalationPhase.PAUSING, EscalationPhase.OVERRIDE_WAITING, EscalationPhase.ACTIVE, EscalationPhase.OVERRIDE_ACTIVE)
        const val MIN_TYPED_WORDS = 3
        const val MILLIS_PER_SECOND = 1_000L
        const val MINUTES_PER_HOUR = 60
    }
}
