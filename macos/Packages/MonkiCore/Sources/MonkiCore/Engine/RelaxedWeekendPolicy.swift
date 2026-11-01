// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// Relaxed weekends (SEMANTICS.md §6.4), a softer weekend the user opts into
// with `ruleset.relaxedWeekends.enabled`:
//
// - a **relaxed night**: bedtime is active in at least one pinned zone and,
//   in every zone where it is active, the active window started on a Friday
//   or a Saturday (the part after midnight included). Bedtime then gates with
//   an intention instead of blocking (§5.2 step 4);
// - a **relaxed day**: the local weekday is Saturday or Sunday in every
//   pinned zone. A `block` or `hide-feed` rule on a short-video surface then
//   takes part as `friction` (§5.1).
//
// Only bedtime boundaries and local midnights change either answer, and
// `validUntil` already visits both (§5.6).

/// Local start days of relaxed bedtime windows: Friday and Saturday (Monday = 0).
private let relaxedNightStartDays: Set<Int> = [Weekday.fri.index, Weekday.sat.index]

/// Local weekdays of relaxed days: Saturday and Sunday (Monday = 0).
private let relaxedWeekdays: Set<Int> = [Weekday.sat.index, Weekday.sun.index]

private func isRelaxedWeekendsOn(_ ruleset: Ruleset) -> Bool {
    ruleset.relaxedWeekends?.enabled ?? false
}

/// Whether bedtime is in a relaxed night at the instant (a stricter zone keeps the block, §6.3).
func isRelaxedNight(_ ruleset: Ruleset, _ epochSeconds: Int, zones: [TimeZone]) -> Bool {
    guard isRelaxedWeekendsOn(ruleset), ruleset.bedtime.enabled else { return false }
    let window = ruleset.bedtime.window
    let startDays = zones.compactMap { zone in
        window.occurrence(at: localTimeAt(epochSeconds, zone)).map { weekdayOfDay($0.startDayNumber) }
    }
    return !startDays.isEmpty && startDays.allSatisfy(relaxedNightStartDays.contains)
}

/// Whether the instant falls on a Saturday or Sunday in every pinned zone.
func isRelaxedDay(_ ruleset: Ruleset, _ epochSeconds: Int, zones: [TimeZone]) -> Bool {
    guard isRelaxedWeekendsOn(ruleset) else { return false }
    return zones.allSatisfy { relaxedWeekdays.contains(localTimeAt(epochSeconds, $0).weekday) }
}

/// The candidates as they take part on a relaxed day: each `block` or
/// `hide-feed` rule on a short-video surface becomes a `friction` copy.
func relaxedDayCandidates(_ rules: [Rule], _ catalog: RulesCatalog) -> [Rule] {
    rules.map { rule in
        guard rule.mode == .block || rule.mode == .hideFeed,
            case .surface(let surface) = rule.target,
            catalog.isShortVideo(surface)
        else { return rule }
        var relaxed = rule
        relaxed.mode = .friction
        return relaxed
    }
}
