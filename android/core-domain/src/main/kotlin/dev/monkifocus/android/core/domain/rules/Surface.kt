// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `surface-registry.schema.json#/$defs/surface`. */
@Serializable
data class Surface(
    val id: String,
    val family: String,
    val kind: SurfaceKind,
)
