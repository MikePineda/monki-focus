// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `decision.schema.json#/$defs/frictionType`: how a pause is presented, in rotation order. */
@Serializable
enum class FrictionType {
    @SerialName("countdown")
    COUNTDOWN,

    @SerialName("breath")
    BREATH,

    @SerialName("reflect")
    REFLECT,

    @SerialName("type-intention")
    TYPE_INTENTION,
}
