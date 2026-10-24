// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `decision.schema.json#/$defs/gate`: the friction gate shown for one attempt (SEMANTICS.md §7.1). */
@Serializable
data class Gate(
    /** 0 … 3. */
    val level: Int,
    val pauseSeconds: Int,
    val frictionType: FrictionType,
    val requiresTypedIntention: Boolean,
    val requiresGuardianKey: Boolean,
)
