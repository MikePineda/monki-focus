// SPDX-License-Identifier: AGPL-3.0-or-later

/// Access-axis strictness; `hide-feed` does not compete for access.
private func accessStrictness(_ mode: RuleMode) -> Int? {
    switch mode {
    case .allow: 0
    case .friction: 1
    case .block: 2
    case .hideFeed: nil
    }
}

/// The outrank check (SEMANTICS.md §8): a rule that becomes active where it
/// was not is tightening only if, at every instant it is active, it does not
/// outrank (§4, access axis) an overlapping rule of what applies today with a
/// stricter mode (`block` above `friction`). Otherwise a friction rule more
/// specific than a block would turn the block into a gate.
func passesOutrankCheck(_ rule: Rule, applyingToday: [Rule], workHours: Schedule, _ catalog: RulesCatalog) -> Bool {
    guard let strictness = accessStrictness(rule.mode) else { return true }
    let week = WeekSet(resolveSchedules(rule.schedules, workHours: workHours))
    return !applyingToday.contains { other in
        guard other.id != rule.id, other.enabled, let otherStrictness = accessStrictness(other.mode),
            otherStrictness > strictness
        else { return false }
        return targetsOverlap(rule.target, other.target, catalog)
            && week.intersects(WeekSet(resolveSchedules(other.schedules, workHours: workHours)))
            && outranks(rule, other, catalog)
    }
}
