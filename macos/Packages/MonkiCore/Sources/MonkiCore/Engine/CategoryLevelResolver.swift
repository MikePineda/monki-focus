// SPDX-License-Identifier: AGPL-3.0-or-later

// The category level `decide` needs for bedtime (SEMANTICS.md §5.2.1, §9),
// always with the default categories. Uncategorised is 50.
//
// - Known path: the most specific assignment by §4 steps 1–4; on a full tie a
//   user assignment beats a default, then the lower level, then list order.
// - Unknown path (§5.5): the minimum level over every assignment of the
//   domain: site targets of the domain with any path and surface targets of
//   its profile (`youtube.com` counts as 0 because of Shorts).

let uncategorisedLevel = 50

private struct RankedAssignment {
    let assignment: CategoryAssignment
    let isUser: Bool
    let order: Int
}

private func compareAssignments(_ lhs: RankedAssignment, _ rhs: RankedAssignment, _ catalog: RulesCatalog) -> Int {
    let targets = TargetSpecificity(lhs.assignment.target, catalog)
        .compare(TargetSpecificity(rhs.assignment.target, catalog))
    if targets != 0 { return targets }
    if lhs.isUser != rhs.isUser { return lhs.isUser ? -1 : 1 }
    if lhs.assignment.level != rhs.assignment.level { return lhs.assignment.level - rhs.assignment.level }
    return lhs.order - rhs.order
}

func categoryLevelOf(
    _ observation: ResolvedObservation,
    userAssignments: [CategoryAssignment],
    _ catalog: RulesCatalog
) -> Int {
    if observation == .rejected { return uncategorisedLevel }
    let entries = userAssignments.map { ($0, true) } + catalog.defaultCategories.map { ($0, false) }
    let ranked = entries.enumerated().map { RankedAssignment(assignment: $1.0, isUser: $1.1, order: $0) }
    if let host = observation.hostOfUnknownPath {
        let levels =
            ranked
            .filter { matchesHostOfUnknownPath($0.assignment.target, host: host, catalog) }
            .map(\.assignment.level)
        return levels.min() ?? uncategorisedLevel
    }
    let best =
        ranked
        .filter { matchesTarget($0.assignment.target, observation, catalog) }
        .min { compareAssignments($0, $1, catalog) < 0 }
    return best?.assignment.level ?? uncategorisedLevel
}
