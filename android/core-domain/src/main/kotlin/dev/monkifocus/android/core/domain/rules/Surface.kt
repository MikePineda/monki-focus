// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `surface-registry.schema.json#/$defs/surface`. `shortVideo` marks Reels and Shorts (relaxed weekends, §6.4). */
@Serializable
data class Surface(
    val id: String,
    val family: String,
    val kind: SurfaceKind,
    val shortVideo: Boolean = false,
)
