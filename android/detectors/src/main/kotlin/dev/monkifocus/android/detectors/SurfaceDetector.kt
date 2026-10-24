// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.Serializable

/**
 * `detector-pack.schema.json#/$defs/surfaceDetector`: [surface] applies when
 * every [all] predicate, at least one [any] predicate (when present) and no
 * [none] predicate match the screen.
 */
@Serializable
data class SurfaceDetector(
    val surface: String,
    val priority: Int,
    val all: List<NodePredicate>? = null,
    val any: List<NodePredicate>? = null,
    val none: List<NodePredicate>? = null,
)
