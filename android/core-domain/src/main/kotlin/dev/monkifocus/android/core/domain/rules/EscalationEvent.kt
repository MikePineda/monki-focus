// SPDX-License-Identifier: AGPL-3.0-or-later
@file:OptIn(ExperimentalSerializationApi::class)

package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** `escalation.schema.json#/$defs/event`: what happened to a target group (SEMANTICS.md §7.3). */
@Serializable
@JsonClassDiscriminator("type")
sealed class EscalationEvent {
    @Serializable
    @SerialName("visit")
    data object Visit : EscalationEvent()

    @Serializable
    @SerialName("pause_elapsed")
    data object PauseElapsed : EscalationEvent()

    @Serializable
    @SerialName("close")
    data object Close : EscalationEvent()

    /** The user commits to an intention; the typed text itself never reaches the engine. */
    @Serializable
    @SerialName("commit")
    data class Commit(
        val minutes: Int,
        val typedWords: Int,
        val guardianKeyVerified: Boolean,
    ) : EscalationEvent()

    @Serializable
    @SerialName("intention_expired")
    data object IntentionExpired : EscalationEvent()

    @Serializable
    @SerialName("leave")
    data object Leave : EscalationEvent()

    @Serializable
    @SerialName("extend")
    data object Extend : EscalationEvent()

    @Serializable
    @SerialName("emergency_request")
    data object EmergencyRequest : EscalationEvent()

    @Serializable
    @SerialName("emergency_wait_elapsed")
    data object EmergencyWaitElapsed : EscalationEvent()

    @Serializable
    @SerialName("emergency_expired")
    data object EmergencyExpired : EscalationEvent()
}
