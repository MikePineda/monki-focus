// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.Serializable

/**
 * `detector-pack.schema.json`: data-only predicates that classify the screen
 * of [packages] into a surface (SEMANTICS.md §11). Decode only through
 * [DetectorPackLoader], which validates the schema first.
 */
@Serializable
data class DetectorPack(
    val schemaVersion: Int,
    val packId: String,
    val packVersion: String,
    val minSchemaVersion: Int,
    val packages: List<String>,
    val testedAppVersions: List<String>,
    val unclassifiedCapMinutes: Int,
    val keepVisible: List<String>,
    val urlBarViewIds: List<String> = emptyList(),
    val surfaces: List<SurfaceDetector>,
) {
    /** [packVersion] parsed; the schema guarantees its shape. */
    val version: PackVersion get() = PackVersion.parse(packVersion)

    fun appliesTo(packageName: String): Boolean = packageName in packages

    /** Detectors in evaluation order: descending priority, ties by surface id ascending. */
    val orderedSurfaces: List<SurfaceDetector> by lazy {
        surfaces.sortedWith(compareByDescending<SurfaceDetector> { it.priority }.thenBy { it.surface })
    }
}
