// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/** `category-assignment.schema.json`: a productivity level (0, 25, 50, 75, 100) for a target. */
@Serializable
data class CategoryAssignment(
    val target: Target,
    val level: Int,
    val category: String,
)
