// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/*
 * Category changes (SEMANTICS.md §8), by normalised target: tightening iff
 * present in both with a level that is lower or equal (more distracting
 * reaches bedtime sooner); an added, removed or raised assignment waits.
 * Returns what applies today: `new`'s list with every waiting assignment
 * replaced by its old version (added ones left out, removed ones kept at the
 * end in their old order).
 */

internal fun planCategories(
    previous: List<CategoryAssignment>,
    next: List<CategoryAssignment>,
    catalog: RulesCatalog,
): CategoryPlan {
    fun keyOf(assignment: CategoryAssignment): String = canonicalTargetKey(assignment.target, catalog)
    val previousByKey = previous.associateBy(::keyOf)
    val nextKeys = next.map(::keyOf).toSet()
    val today = mutableListOf<CategoryAssignment>()
    var waits = false
    for (assignment in next) {
        val before = previousByKey[keyOf(assignment)]
        when {
            before == null -> {
                waits = true
            }

            assignment.level <= before.level -> {
                today += assignment
            }

            else -> {
                today += before
                waits = true
            }
        }
    }
    val removed = previous.filter { keyOf(it) !in nextKeys }
    return CategoryPlan(today + removed, waits || removed.isNotEmpty())
}
