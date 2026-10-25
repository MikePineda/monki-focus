// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// `effectiveRuleSet(old, new, now, pendingEffectiveFrom, catalog) →
// {effectiveToday, effectiveFrom}` (SEMANTICS.md §8). `old` is the currently
// effective set. A change that only tightens applies at once; anything else
// waits for the next local midnight (or the end of an old window running
// then) and never earlier than a pending change. Each part (rule by id,
// bedtime, work hours, time zone, category by target) is judged on its own.

private struct RulePart {
    let id: String
    let previous: Rule?
    let next: Rule?
    let verdict: RuleVerdict

    /// The rule of a part as it applies today: `new` when the part applies, else `old`.
    func today(applies: Bool) -> Rule? { applies ? next : previous }
}

/// Parts that tighten by the field rules, then the outrank check against what
/// would actually apply now, iterated to a fixed point (§8).
private func applicableRuleIds(_ parts: [RulePart], workHoursToday: Schedule, _ catalog: RulesCatalog) -> Set<
    String
> {
    var applicable = Set(parts.filter(\.verdict.tightens).map(\.id))
    while true {
        let today = parts.compactMap { $0.today(applies: applicable.contains($0.id)) }
        let failing = parts.filter { part in
            guard applicable.contains(part.id), part.verdict.activates, let next = part.next else { return false }
            return !passesOutrankCheck(next, applyingToday: today, workHours: workHoursToday, catalog)
        }
        if failing.isEmpty { return applicable }
        for part in failing { applicable.remove(part.id) }
    }
}

/// `{ref: "workHours"}` resolves to `old.workHours` in the old rule and to the
/// work hours that apply today in the new one (§8).
private func ruleParts(_ old: Ruleset, _ next: Ruleset, workHoursToday: Schedule, _ catalog: RulesCatalog)
    -> [RulePart]
{
    var previousById: [String: Rule] = [:]
    for rule in old.rules { previousById[rule.id] = rule }
    var nextById: [String: Rule] = [:]
    for rule in next.rules { nextById[rule.id] = rule }
    let ids = Set(previousById.keys).union(nextById.keys).sorted(by: CodeUnitOrder.less)
    let workHours = WorkHoursPair(previous: old.workHours, next: workHoursToday)
    return ids.map { id in
        let previous = previousById[id]
        let rule = nextById[id]
        let unchanged = previous != nil && previous == rule
        let verdict =
            unchanged
            ? RuleVerdict(tightens: true, activates: false) : judgeRuleChange(previous, rule, workHours, catalog)
        return RulePart(id: id, previous: previous, next: rule, verdict: verdict)
    }
}

/// Whether the old schedule windows of a waiting rule must run to their end
/// (§8 step 2): its `schedules` changed, or it is an enabled non-allow rule
/// that is removed or disabled (deleting a block during its window waits).
private func windowRunsOut(_ part: RulePart) -> Bool {
    guard let previous = part.previous else { return false }
    if let next = part.next, previous.schedules != next.schedules { return true }
    let stopsApplying = part.next.map { !$0.enabled } ?? true
    return stopsApplying && previous.enabled && previous.mode != .allow
}

public func effectiveRuleSet(
    old: Ruleset,
    new next: Ruleset,
    now: String,
    pendingEffectiveFrom: String?,
    catalog: RulesCatalog
) throws -> EffectiveRuleSet {
    let nowSeconds = try epochSecondsOf(now)
    let timeZoneWaits = old.timeZone != next.timeZone
    let workHoursWait = old.workHours != next.workHours
    let bedtimeWaits = bedtimeChangeWaits(old.bedtime, next.bedtime)
    let categories = CategoryPlan(previous: old.categories, next: next.categories, catalog)
    let workHoursToday = workHoursWait ? old.workHours : next.workHours
    let parts = ruleParts(old, next, workHoursToday: workHoursToday, catalog)
    let applicable = applicableRuleIds(parts, workHoursToday: workHoursToday, catalog)
    let waitingRules = parts.filter { !applicable.contains($0.id) }

    let somethingWaits = timeZoneWaits || workHoursWait || bedtimeWaits || categories.waits || !waitingRules.isEmpty
    guard somethingWaits else { return EffectiveRuleSet(effectiveToday: next, effectiveFrom: nil) }

    // A waiting zone change keeps the old zone and evaluates the new one alongside it (§6.3).
    var effectiveToday = next
    if timeZoneWaits {
        effectiveToday.timeZone = old.timeZone
        effectiveToday.pendingTimeZone = next.timeZone
    }
    // Parts are in id order, so the rules are sorted by id (§8).
    effectiveToday.rules = parts.compactMap { $0.today(applies: applicable.contains($0.id)) }
    effectiveToday.categories = categories.categoriesToday
    effectiveToday.bedtime = bedtimeWaits ? old.bedtime : next.bedtime
    effectiveToday.workHours = workHoursToday

    // §8 step 2: old windows of the waiting parts that must run to their end.
    var windows: [Schedule] = []
    if bedtimeWaits || categories.waits || timeZoneWaits, old.bedtime.enabled {
        windows.append(old.bedtime.window)
    }
    if workHoursWait { windows.append(old.workHours) }
    let windowedOldRules =
        timeZoneWaits ? old.rules.filter(\.enabled) : waitingRules.filter(windowRunsOut).compactMap(\.previous)
    for rule in windowedOldRules {
        windows.append(contentsOf: resolveSchedules(rule.schedules, workHours: old.workHours))
    }

    let zoneNames = timeZoneWaits ? [old.timeZone, next.timeZone] : [old.timeZone]
    var zones: [TimeZone] = []
    for name in zoneNames { zones.append(try ZoneLookup.zone(named: name)) }
    let pending = try pendingEffectiveFrom.map { try epochSecondsOf($0) }
    let effectiveFrom = effectiveFromOf(nowSeconds: nowSeconds, zones: zones, windows: windows, pendingSeconds: pending)
    return EffectiveRuleSet(effectiveToday: effectiveToday, effectiveFrom: utcInstantOf(effectiveFrom))
}
