// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.ResolvedObservation
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.UNCATEGORISED_LEVEL
import dev.monkifocus.android.core.domain.engine.mostSpecificAssignment
import dev.monkifocus.android.core.domain.rules.CategoryAssignment

/*
 * `categorise(activity, assignments, includeDefaults)` of SEMANTICS.md §9:
 * assignments match like rule targets (§3, the engine's `matchesTarget`) and
 * the most specific wins by §4 steps 1–4 (the engine's `targetSpecificity`);
 * on a full tie a user assignment beats a default, then the lower level,
 * then list order (the engine's `mostSpecificAssignment`, which `decide`
 * uses for bedtime too). No match is neutral `uncategorised`. The defaults
 * come from the rules catalog (`data/categories/default.json`).
 */

val UNCATEGORISED: CategoryMatch = CategoryMatch(level = UNCATEGORISED_LEVEL, categoryPath = "uncategorised")

/** The activity as a target-matching observation: a site for web time, an app otherwise. */
private fun observationOf(activity: CategorisableActivity): ResolvedObservation =
    if (activity.source != ActivitySource.WEB) {
        ResolvedObservation.App(packageName = activity.activityKey, surface = activity.surface)
    } else {
        ResolvedObservation.Site(
            host = activity.activityKey,
            path = activity.path ?: "/",
            pathKnown = activity.path != null,
            surface = activity.surface,
        )
    }

fun categorise(
    activity: CategorisableActivity,
    assignments: List<CategoryAssignment>,
    catalog: RulesCatalog,
    includeDefaults: Boolean = true,
): CategoryMatch {
    val defaults = if (includeDefaults) catalog.defaultCategories else emptyList()
    val winner = mostSpecificAssignment(observationOf(activity), assignments, defaults, catalog) ?: return UNCATEGORISED
    return CategoryMatch(level = winner.level, categoryPath = winner.category)
}
