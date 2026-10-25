// SPDX-License-Identifier: AGPL-3.0-or-later

/// Category changes (SEMANTICS.md §8), by normalised target: tightening iff
/// present in both with a level that is lower or equal (more distracting
/// reaches bedtime sooner); an added, removed or raised assignment waits.
/// `categoriesToday` is `new`'s list with every waiting assignment replaced
/// by its old version (added ones left out, removed ones kept at the end in
/// their old order).
struct CategoryPlan {
    let categoriesToday: [CategoryAssignment]
    let waits: Bool

    init(previous: [CategoryAssignment], next: [CategoryAssignment], _ catalog: RulesCatalog) {
        let keyOf = { (assignment: CategoryAssignment) in canonicalTargetKey(assignment.target, catalog) }
        var previousByKey: [String: CategoryAssignment] = [:]
        for assignment in previous { previousByKey[keyOf(assignment)] = assignment }
        let nextKeys = Set(next.map(keyOf))
        var today: [CategoryAssignment] = []
        var waits = false
        for assignment in next {
            guard let before = previousByKey[keyOf(assignment)] else {
                waits = true
                continue
            }
            if assignment.level <= before.level {
                today.append(assignment)
            } else {
                today.append(before)
                waits = true
            }
        }
        let removed = previous.filter { !nextKeys.contains(keyOf($0)) }
        categoriesToday = today + removed
        self.waits = waits || !removed.isEmpty
    }
}
