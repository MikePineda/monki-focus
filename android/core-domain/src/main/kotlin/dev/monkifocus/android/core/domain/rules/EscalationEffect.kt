// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `escalation.schema.json#/$defs/effect`: what the adapter must do after a transition. */
@Serializable
enum class EscalationEffect {
    /** Report the emergency override to the guardian (queued while offline). */
    @SerialName("record_bypass")
    RECORD_BYPASS,
}
