// SPDX-License-Identifier: AGPL-3.0-or-later

/// Daily totals (SEMANTICS.md §10.7): intervals are split at local midnight
/// in the pinned time zone (the engine's zoned time, so DST days have 23 or
/// 25 hours); per local date the total, the seconds by level and the pulse.
/// Only dates with time appear, ascending.
public func dailyTotals(_ entries: [LevelledInterval], timeZone: String) throws -> [DailyTotal] {
    let zone = try ZoneLookup.zone(named: timeZone)
    var days: [String: SecondsByLevel] = [:]
    for entry in entries {
        var cursor = try epochSecondsOf(entry.timestamp)
        let end = cursor + entry.duration
        while cursor < end {
            let pieceEnd = min(nextLocalMidnight(cursor, zone), end)
            let date = localTimeAt(cursor, zone).localDate
            try days[date, default: SecondsByLevel()].add(pieceEnd - cursor, at: entry.level)
            cursor = pieceEnd
        }
    }
    return days.sorted { CodeUnitOrder.less($0.key, $1.key) }
        .map { date, byLevel in
            let levelled = categoryLevels.map { PulseInput(seconds: byLevel[$0], level: $0) }
            return DailyTotal(
                date: date,
                seconds: levelled.reduce(0) { $0 + $1.seconds },
                secondsByLevel: byLevel,
                pulse: pulse(levelled)
            )
        }
}
