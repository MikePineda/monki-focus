// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate.state

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.rules.Access
import dev.monkifocus.android.core.domain.rules.Content
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.EscalationPhase
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.domain.rules.Gate
import dev.monkifocus.android.core.domain.rules.ReasonCode

/** Synthetic decisions and escalation states for the gate tests. */
internal const val NOW = "2026-01-05T09:00:00Z"
internal val NOW_SECONDS: Long = epochSecondsOf(NOW)
internal const val TARGET = "example.com"
internal const val RULE_ID = "rule-example"

internal fun aGate(
    level: Int = 0,
    pauseSeconds: Int = 5,
    frictionType: FrictionType = FrictionType.COUNTDOWN,
    requiresTypedIntention: Boolean = level >= 2,
    requiresGuardianKey: Boolean = false,
) = Gate(level, pauseSeconds, frictionType, requiresTypedIntention, requiresGuardianKey)

internal fun aGateDecision(gate: Gate? = aGate()) =
    Decision(
        access = Access.GATE,
        content = Content.SHOW,
        ruleId = RULE_ID,
        reason = ReasonCode.INTENTION_REQUIRED,
        gate = gate,
        explanationKey = ExplanationKey.INTENTION_REQUIRED,
        validUntil = nowPlus(60),
    )

internal fun aBlockDecision(
    reason: ReasonCode,
    explanationKey: ExplanationKey,
) = Decision(
    access = Access.BLOCK,
    content = Content.SHOW,
    ruleId = if (reason == ReasonCode.SCHEDULE_BEDTIME || reason == ReasonCode.ENGINE_ERROR) null else RULE_ID,
    reason = reason,
    gate = null,
    explanationKey = explanationKey,
    validUntil = if (reason == ReasonCode.ENGINE_ERROR) null else nowPlus(60),
)

internal fun anAllowDecision() =
    Decision(
        access = Access.ALLOW,
        content = Content.SHOW,
        ruleId = RULE_ID,
        reason = ReasonCode.INTENTION_ACTIVE,
        gate = null,
        explanationKey = ExplanationKey.INTENTION_ACTIVE,
        validUntil = nowPlus(60),
    )

internal fun anEscalation(
    phase: EscalationPhase,
    gate: Gate? = null,
    pauseEndsAt: String? = null,
    pendingExtension: Boolean = false,
    overrideReadyAt: String? = null,
    brokenCount: Int = 0,
) = EscalationState(
    targetGroup = RULE_ID,
    phase = phase,
    attemptCount = 1,
    lastAttemptAt = NOW,
    lastActivityAt = NOW,
    brokenCount = brokenCount,
    lastFrictionType = gate?.frictionType,
    gate = gate,
    pauseEndsAt = pauseEndsAt,
    pendingExtension = pendingExtension,
    intentionExpiresAt = null,
    overrideReadyAt = overrideReadyAt,
    overrideEndsAt = null,
)

/** `NOW` plus [seconds], in the canonical UTC form. */
internal fun nowPlus(seconds: Long): String = utcInstantOf(NOW_SECONDS + seconds)

internal fun anInput(
    decision: Decision,
    escalation: EscalationState? = null,
    guardianLinked: Boolean = false,
    previousIntention: String? = null,
    timedOutIntention: String? = null,
    timedOutMinutes: Int? = null,
    bedtimeEndMinuteOfDay: Int? = null,
) = GateInput(
    decision = decision,
    escalation = escalation,
    nowEpochSeconds = NOW_SECONDS,
    targetLabel = TARGET,
    guardianLinked = guardianLinked,
    previousIntention = previousIntention,
    timedOutIntention = timedOutIntention,
    timedOutMinutes = timedOutMinutes,
    bedtimeEndMinuteOfDay = bedtimeEndMinuteOfDay,
)
