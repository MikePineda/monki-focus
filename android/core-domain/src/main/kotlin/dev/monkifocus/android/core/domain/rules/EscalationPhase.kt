// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `escalation.schema.json#/$defs/phase` (SEMANTICS.md §7.3). */
@Serializable
enum class EscalationPhase {
    @SerialName("idle")
    IDLE,

    @SerialName("pausing")
    PAUSING,

    @SerialName("asking")
    ASKING,

    @SerialName("active")
    ACTIVE,

    @SerialName("timed_out")
    TIMED_OUT,

    @SerialName("override_waiting")
    OVERRIDE_WAITING,

    @SerialName("override_active")
    OVERRIDE_ACTIVE,
}
