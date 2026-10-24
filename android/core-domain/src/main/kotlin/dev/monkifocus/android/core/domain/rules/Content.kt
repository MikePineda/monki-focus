// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `decision.schema.json#/$defs/content`: the content axis of a decision. */
@Serializable
enum class Content {
    @SerialName("show")
    SHOW,

    @SerialName("hide-feed")
    HIDE_FEED,
}
