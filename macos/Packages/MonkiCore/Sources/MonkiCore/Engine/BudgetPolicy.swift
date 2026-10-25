// SPDX-License-Identifier: AGPL-3.0-or-later

// Daily budgets (SEMANTICS.md §5.2.2): any candidate, on either axis, whose
// `dailyBudgetMinutes` is spent blocks (the most specific one names the
// decision). Usage only counts when it is dated today in a pinned zone
// (either zone while a zone change waits), so a budget block lasts until
// local midnight and a move to a zone behind never grants an extra day.

func exhaustedBudgetRule(
    _ candidates: [Rule],
    usage: DailyUsage?,
    todayDates: [String],
    _ catalog: RulesCatalog
) -> Rule? {
    guard let usage, todayDates.contains(usage.localDate) else { return nil }
    let exhausted = candidates.filter { rule in
        guard let budget = rule.dailyBudgetMinutes else { return false }
        // Rule ids are plain dictionary keys: no id reaches anything but its own entry (§14).
        return (usage.secondsByRule[rule.id] ?? 0) >= budget * 60
    }
    return mostSpecific(exhausted, catalog)
}
