// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/** What applies today of a category change (SEMANTICS.md §8) and whether any part of it waits. */
internal data class CategoryPlan(
    val categoriesToday: List<CategoryAssignment>,
    val waits: Boolean,
)
