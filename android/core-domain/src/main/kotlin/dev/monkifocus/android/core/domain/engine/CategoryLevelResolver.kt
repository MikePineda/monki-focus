// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/*
 * The category level `decide` needs for bedtime (SEMANTICS.md §5.2.1, §9),
 * always with the default categories. Uncategorised is 50.
 *
 * - Known path: the most specific assignment by §4 steps 1–4; on a full tie a
 *   user assignment beats a default, then the lower level, then list order.
 * - Unknown path (§5.5): the minimum level over every assignment of the
 *   domain: site targets of the domain with any path and surface targets of
 *   its profile (`youtube.com` counts as 0 because of Shorts).
 */

internal const val UNCATEGORISED_LEVEL = 50

private data class RankedAssignment(
    val assignment: CategoryAssignment,
    val isUser: Boolean,
    val order: Int,
)

private fun compareAssignments(
    a: RankedAssignment,
    b: RankedAssignment,
    catalog: RulesCatalog,
): Int =
    compareTargetSpecificity(targetSpecificity(a.assignment.target, catalog), targetSpecificity(b.assignment.target, catalog))
        .takeIf { it != 0 }
        ?: (b.isUser.compareTo(a.isUser)).takeIf { it != 0 }
        ?: (a.assignment.level - b.assignment.level).takeIf { it != 0 }
        ?: (a.order - b.order)

private fun rankedAssignments(
    userAssignments: List<CategoryAssignment>,
    catalog: RulesCatalog,
): List<RankedAssignment> =
    (userAssignments.map { it to true } + catalog.defaultCategories.map { it to false })
        .mapIndexed { order, (assignment, isUser) -> RankedAssignment(assignment, isUser, order) }

internal fun categoryLevelOf(
    observation: ResolvedObservation,
    userAssignments: List<CategoryAssignment>,
    catalog: RulesCatalog,
): Int {
    if (observation is ResolvedObservation.Rejected) return UNCATEGORISED_LEVEL
    val ranked = rankedAssignments(userAssignments, catalog)
    if (observation is ResolvedObservation.Site && !observation.pathKnown) {
        return ranked
            .filter { matchesHostOfUnknownPath(it.assignment.target, observation.host, catalog) }
            .minOfOrNull { it.assignment.level } ?: UNCATEGORISED_LEVEL
    }
    return ranked
        .filter { matchesTarget(it.assignment.target, observation, catalog) }
        .minWithOrNull { a, b -> compareAssignments(a, b, catalog) }
        ?.assignment
        ?.level ?: UNCATEGORISED_LEVEL
}
