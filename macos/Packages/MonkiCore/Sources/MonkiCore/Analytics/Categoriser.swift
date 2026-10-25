// SPDX-License-Identifier: AGPL-3.0-or-later

/// Neutral time no assignment matches (SEMANTICS.md §9).
public let uncategorised = CategoryMatch(level: uncategorisedLevel, categoryPath: "uncategorised")

/// `categorise(activity, assignments, includeDefaults)` of SEMANTICS.md §9:
/// assignments match like rule targets (§3, the engine's `matchesTarget`)
/// and the most specific wins by §4 steps 1–4; on a full tie a user
/// assignment beats a default, then the lower level, then list order (the
/// engine's `mostSpecificAssignment`, which `decide` uses for bedtime too).
/// No match is neutral `uncategorised`. The defaults come from the rules
/// catalog (`data/categories/default.json`).
public func categorise(
    _ activity: CategorisableActivity,
    assignments: [CategoryAssignment],
    catalog: RulesCatalog,
    includeDefaults: Bool = true
) -> CategoryMatch {
    let winner = mostSpecificAssignment(
        observation(of: activity),
        userAssignments: assignments,
        defaults: includeDefaults ? catalog.defaultCategories : [],
        catalog
    )
    guard let winner else { return uncategorised }
    return CategoryMatch(level: winner.level, categoryPath: winner.category)
}

/// The activity as a target-matching observation: a site for web time, an app otherwise.
private func observation(of activity: CategorisableActivity) -> ResolvedObservation {
    guard activity.source == .web else { return .app(package: activity.activityKey, surface: activity.surface) }
    return .site(
        host: activity.activityKey,
        path: activity.path ?? "/",
        pathKnown: activity.path != nil,
        surface: activity.surface
    )
}
