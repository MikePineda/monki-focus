// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `rule.schema.json#/$defs/mode`. */
@Serializable
enum class RuleMode {
    @SerialName("allow")
    ALLOW,

    @SerialName("hide-feed")
    HIDE_FEED,

    @SerialName("friction")
    FRICTION,

    @SerialName("block")
    BLOCK,
}
