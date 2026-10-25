// SPDX-License-Identifier: AGPL-3.0-or-later

// A weekly `{days, start, end}` window in local wall-clock minutes
// (SEMANTICS.md §6.1): for each listed day `d`, `[d + start, d + start + length)`
// with `length = (end − start) mod 24 h` and `0` meaning 24 hours. A window
// that crosses midnight belongs to the day it starts on. Used by schedules,
// `workHours` and bedtime alike (`Bedtime.window`).

let minutesPerDay = 1440

/// One occurrence of a window: the local day it starts on and its minutes.
struct WindowOccurrence: Hashable {
    let startDayNumber: Int
    let startMinute: Int
    let lengthMinutes: Int
}

extension Schedule {
    var startMinute: Int { start.minutes }

    var lengthMinutes: Int {
        let length = (end.minutes - start.minutes + minutesPerDay) % minutesPerDay
        return length == 0 ? minutesPerDay : length
    }

    func startsOn(_ weekday: Int) -> Bool {
        days.contains { $0.index == weekday }
    }

    /// The occurrence of the window that contains the local time, if any.
    /// Windows last at most 24 hours, so only the previous and the current
    /// local day can contain it.
    func occurrence(at local: LocalTime) -> WindowOccurrence? {
        let start = startMinute
        let length = lengthMinutes
        for daysBack in [1, 0] {
            let minute = local.minuteOfDay + daysBack * minutesPerDay
            let weekday = (local.weekday - daysBack + 7) % 7
            if startsOn(weekday), minute >= start, minute < start + length {
                return WindowOccurrence(
                    startDayNumber: local.dayNumber - daysBack,
                    startMinute: start,
                    lengthMinutes: length
                )
            }
        }
        return nil
    }

    /// Whether the local time falls in `[start − minutesBefore, start)` of a
    /// listed day (the bedtime warning, §6.2). The lead may reach into the
    /// previous local day.
    func isInLeadUp(at local: LocalTime, minutesBefore: Int) -> Bool {
        let start = startMinute
        for daysAhead in [0, 1] {
            let minute = local.minuteOfDay - daysAhead * minutesPerDay
            let weekday = (local.weekday + daysAhead) % 7
            if startsOn(weekday), minute >= start - minutesBefore, minute < start { return true }
        }
        return false
    }
}
