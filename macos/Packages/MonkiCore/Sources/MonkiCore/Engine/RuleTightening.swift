// SPDX-License-Identifier: AGPL-3.0-or-later

// The field rules of SEMANTICS.md §8 for one rule id: whether a change only
// tightens, and whether the rule becomes active where it was not (added,
// enabled, schedule widened), which also needs the outrank check.
//
// - Added: tightening iff enabled and not `allow` (outrank check).
// - Removed: tightening iff it was an enabled `allow` rule without a budget.
// - Modified: tightening iff every changed field tightens: target unchanged;
//   `enabled` false → true for a non-allow rule (outrank check) or true →
//   false for an allow rule without a budget; mode `allow → any`,
//   `friction → block`, `hide-feed → block`; on a non-allow rule, schedules
//   whose week set contains the old one (outrank check when it grows); a
//   budget added or lowered; `note` is neutral.

struct RuleVerdict: Hashable {
    let tightens: Bool
    /// Becomes active where it was not: tightening only if it passes the outrank check.
    let activates: Bool
}

struct WorkHoursPair {
    let previous: Schedule
    let next: Schedule
}

private func modeTightens(_ previous: Rule, _ next: Rule) -> Bool {
    previous.mode == next.mode || previous.mode == .allow
        || (next.mode == .block && (previous.mode == .friction || previous.mode == .hideFeed))
}

private func budgetTightens(_ previous: Rule, _ next: Rule) -> Bool {
    let before = previous.dailyBudgetMinutes
    let after = next.dailyBudgetMinutes
    if before == after { return true }
    guard let after else { return false }
    return before.map { after < $0 } ?? true
}

private func isPlainAllow(_ rule: Rule) -> Bool {
    rule.mode == .allow && rule.dailyBudgetMinutes == nil
}

private func judgeModified(_ previous: Rule, _ next: Rule, _ workHours: WorkHoursPair, _ catalog: RulesCatalog)
    -> RuleVerdict
{
    var tightens = canonicalTargetKey(previous.target, catalog) == canonicalTargetKey(next.target, catalog)
    var activates = false
    if previous.enabled != next.enabled {
        if next.enabled {
            tightens = tightens && next.mode != .allow
            activates = true
        } else {
            tightens = tightens && isPlainAllow(previous)
        }
    }
    tightens = tightens && modeTightens(previous, next) && budgetTightens(previous, next)
    if previous.schedules != next.schedules {
        let before = WeekSet(resolveSchedules(previous.schedules, workHours: workHours.previous))
        let after = WeekSet(resolveSchedules(next.schedules, workHours: workHours.next))
        tightens = tightens && next.mode != .allow && after.contains(before)
        activates = activates || after != before
    }
    return RuleVerdict(tightens: tightens, activates: activates && next.enabled)
}

func judgeRuleChange(_ previous: Rule?, _ next: Rule?, _ workHours: WorkHoursPair, _ catalog: RulesCatalog)
    -> RuleVerdict
{
    switch (previous, next) {
    case (nil, let added?):
        return RuleVerdict(tightens: added.enabled && added.mode != .allow, activates: added.enabled)
    case (let removed?, nil):
        return RuleVerdict(tightens: removed.enabled && isPlainAllow(removed), activates: false)
    case (let previous?, let next?):
        return judgeModified(previous, next, workHours, catalog)
    case (nil, nil):
        return RuleVerdict(tightens: true, activates: false)
    }
}
