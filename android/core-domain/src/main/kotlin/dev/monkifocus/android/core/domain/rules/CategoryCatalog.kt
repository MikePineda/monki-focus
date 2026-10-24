// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `category-catalog.schema.json` (`data/categories/default.json`). */
@Serializable
data class CategoryCatalog(
    val schemaVersion: Int,
    val assignments: List<CategoryAssignment>,
)
