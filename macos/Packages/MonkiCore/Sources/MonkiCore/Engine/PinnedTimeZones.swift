// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// The pinned time zone (SEMANTICS.md §6.3). `ruleset.timeZone` is the only
// zone; while a change of zone waits the set also carries `pendingTimeZone`
// and every schedule is evaluated in both with the stricter outcome winning:
// a restrictive rule is active when it is active in either zone, an `allow`
// rule only when it is active in both. The device zone is never an input.

/// The zone names of a rule set: its own, plus the pending one while it waits.
func zoneNamesOf(timeZone: String, pendingTimeZone: String?) -> [String] {
    guard let pending = pendingTimeZone, pending != timeZone else { return [timeZone] }
    return [timeZone, pending]
}

/// The resolved zones of a rule set; throws on a zone the database cannot resolve (§14).
func pinnedZones(of ruleset: Ruleset) throws(EngineError) -> [TimeZone] {
    var zones: [TimeZone] = []
    for name in zoneNamesOf(timeZone: ruleset.timeZone, pendingTimeZone: ruleset.pendingTimeZone) {
        zones.append(try ZoneLookup.zone(named: name))
    }
    return zones
}

/// Whether the rule's schedules make it active at the instant, in the pinned zone(s).
func isRuleScheduledAt(_ rule: Rule, workHours: Schedule, _ epochSeconds: Int, zones: [TimeZone]) -> Bool {
    let activeIn = { (zone: TimeZone) in
        isScheduleActiveAt(rule.schedules, workHours: workHours, epochSeconds, zone)
    }
    return rule.mode == .allow ? zones.allSatisfy(activeIn) : zones.contains(where: activeIn)
}

/// Today's local date in each pinned zone (budget days, §5.2.2).
func localDatesAt(_ epochSeconds: Int, zones: [TimeZone]) -> [String] {
    zones.map { localTimeAt(epochSeconds, $0).localDate }
}
