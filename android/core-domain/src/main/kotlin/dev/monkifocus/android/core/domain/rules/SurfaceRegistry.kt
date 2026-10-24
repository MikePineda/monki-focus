// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `surface-registry.schema.json` (`data/surfaces.json`). */
@Serializable
data class SurfaceRegistry(
    val schemaVersion: Int,
    val surfaces: List<Surface>,
)
