// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// `isScheduleActive(schedules, workHours, now, timeZone)` (SEMANTICS.md §6.1):
// a list of schedules is active when the local wall time falls in one of
// their windows; an empty list is always active. `{ref: "workHours"}`
// resolves to the rule set's work hours.

/// Replaces every `{ref: "workHours"}` with the work hours themselves.
func resolveSchedules(_ schedules: [RuleSchedule], workHours: Schedule) -> [Schedule] {
    schedules.map { schedule in
        switch schedule {
        case .window(let window): window
        case .workHours: workHours
        }
    }
}

/// Same as `isScheduleActive` for an instant already in epoch seconds.
func isScheduleActiveAt(_ schedules: [RuleSchedule], workHours: Schedule, _ epochSeconds: Int, _ zone: TimeZone)
    -> Bool
{
    if schedules.isEmpty { return true }
    let local = localTimeAt(epochSeconds, zone)
    return resolveSchedules(schedules, workHours: workHours).contains { $0.occurrence(at: local) != nil }
}

public func isScheduleActive(
    _ schedules: [RuleSchedule],
    workHours: Schedule,
    now: String,
    timeZone: String
) throws -> Bool {
    let seconds = try epochSecondsOf(now)
    return isScheduleActiveAt(schedules, workHours: workHours, seconds, try ZoneLookup.zone(named: timeZone))
}
