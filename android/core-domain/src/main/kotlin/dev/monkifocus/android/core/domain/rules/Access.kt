// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `decision.schema.json#/$defs/access`: the access axis of a decision. */
@Serializable
enum class Access {
    @SerialName("allow")
    ALLOW,

    @SerialName("gate")
    GATE,

    @SerialName("block")
    BLOCK,
}
