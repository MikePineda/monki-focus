// SPDX-License-Identifier: AGPL-3.0-or-later

/// Week sets (SEMANTICS.md §6.1): for comparisons a list of schedules is the
/// set of minutes it covers on the 10 080-minute week starting Monday 00:00,
/// windows wrapping from Sunday into Monday. Empty schedules are the whole
/// week. `{mon 00:30–07:00}` is not contained in `{mon 22:30–07:00}`.
struct WeekSet: Hashable {
    private static let minutesPerWeek = 7 * minutesPerDay
    private static let wordCount = (minutesPerWeek + 63) / 64

    private var words: [UInt64]

    init(_ windows: [Schedule]) {
        guard !windows.isEmpty else {
            words = Array(repeating: 0, count: Self.wordCount)
            for minute in 0..<Self.minutesPerWeek { insert(minute) }
            return
        }
        words = Array(repeating: 0, count: Self.wordCount)
        for window in windows {
            let length = window.lengthMinutes
            for day in window.days {
                let first = day.index * minutesPerDay + window.startMinute
                for minute in first..<(first + length) {
                    insert(minute % Self.minutesPerWeek)
                }
            }
        }
    }

    private mutating func insert(_ minute: Int) {
        words[minute / 64] |= 1 << UInt64(minute % 64)
    }

    /// Every minute of `inner` is in `self`.
    func contains(_ inner: WeekSet) -> Bool {
        zip(words, inner.words).allSatisfy { outer, inner in inner & ~outer == 0 }
    }

    func intersects(_ other: WeekSet) -> Bool {
        zip(words, other.words).contains { $0 & $1 != 0 }
    }
}
