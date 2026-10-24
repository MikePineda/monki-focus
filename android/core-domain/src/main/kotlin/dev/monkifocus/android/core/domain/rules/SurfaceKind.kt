// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** `feed` can be hidden; `permalink` and `utility` (search, messages) are never hidden. */
@Serializable
enum class SurfaceKind {
    @SerialName("feed")
    FEED,

    @SerialName("permalink")
    PERMALINK,

    @SerialName("utility")
    UTILITY,
}
