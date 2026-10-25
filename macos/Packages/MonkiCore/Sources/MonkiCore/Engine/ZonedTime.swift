// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// Wall-clock time in an IANA zone (SEMANTICS.md §6.3), from `TimeZone` with
// the pinned zone only: the device zone (`TimeZone.current`) is never read.
// A **wall second** counts seconds since 1970-01-01 00:00 *local* time, so a
// local date is `floor(wall / 86400)` and wall-clock arithmetic is plain
// integer arithmetic, which is what makes DST transitions harmless (§6.1).
// Turning a wall time back into an instant follows the TypeScript engine step
// by step (offsets around the wall time, then a binary search of a gap)
// rather than `Calendar.date(from:)`, whose gap and overlap rules differ.

/// Monday = 0 … Sunday = 6, the order of `Weekday`. 1970-01-01 was a Thursday.
private let epochDayWeekday = 3

/// Zone lookups. Like `Intl.DateTimeFormat` in the TypeScript engine, the
/// run-time lookup ignores letter case (validated rule sets carry the exact
/// name anyway); the validator's `x-timeZone` check is case-sensitive.
enum ZoneLookup {
    private static let identifiersByLowerCase: [String: String] = {
        var table: [String: String] = [:]
        for identifier in TimeZone.knownTimeZoneIdentifiers {
            table[identifier.lowercased()] = identifier
        }
        return table
    }()

    /// The zone of an IANA name, or an error the decision fails closed on (§14).
    static func zone(named name: String) throws(EngineError) -> TimeZone {
        if let exact = TimeZone(identifier: name) { return exact }
        if let identifier = identifiersByLowerCase[name.lowercased()], let zone = TimeZone(identifier: identifier) {
            return zone
        }
        throw .unknownTimeZone
    }

    /// True when the time zone database knows the zone under exactly this name
    /// (links such as `Asia/Calcutta` included); a name that only differs from
    /// a known one by letter case is not resolvable (§1, `x-timeZone`).
    static func isResolvable(_ name: String) -> Bool {
        guard let zone = TimeZone(identifier: name) else { return false }
        return zone.identifier == name || zone.identifier.lowercased() != name.lowercased()
    }
}

/// A local wall-clock reading split into its local day and minute.
public struct LocalTime: Hashable, Sendable {
    /// Days since 1970-01-01 in local time.
    public let dayNumber: Int
    /// Monday = 0 … Sunday = 6.
    public let weekday: Int
    /// Whole minutes since local midnight, 0…1439.
    public let minuteOfDay: Int

    /// `YYYY-MM-DD`.
    public var localDate: String { CivilDate.isoDate(ofDayNumber: dayNumber) }
}

/// The local wall second of an instant (epoch seconds) in a zone.
func wallSecondsAt(_ epochSeconds: Int, _ zone: TimeZone) -> Int {
    epochSeconds + zone.secondsFromGMT(for: Date(timeIntervalSince1970: TimeInterval(epochSeconds)))
}

func localTimeAt(_ epochSeconds: Int, _ zone: TimeZone) -> LocalTime {
    let wall = wallSecondsAt(epochSeconds, zone)
    let dayNumber = floorDivision(wall, secondsPerDay)
    return LocalTime(
        dayNumber: dayNumber,
        weekday: weekdayOfDay(dayNumber),
        minuteOfDay: (wall - dayNumber * secondsPerDay) / 60
    )
}

/// Monday = 0 … Sunday = 6 for a local day number (negative day numbers included).
func weekdayOfDay(_ dayNumber: Int) -> Int {
    (((dayNumber + epochDayWeekday) % 7) + 7) % 7
}

/// Wall seconds of the start of a local day.
func wallSecondsOfDay(_ dayNumber: Int) -> Int {
    dayNumber * secondsPerDay
}

/// The first instant after `after` whose wall clock reads at least `wall`
/// (a wall second later than the wall clock at `after`). A wall time in a
/// spring-forward gap resolves to the first existing instant after the gap;
/// a repeated fall-back time resolves to its first occurrence after `after`.
func firstInstantReachingWall(after: Int, wall: Int, _ zone: TimeZone) -> Int {
    func offsetAt(_ epochSeconds: Int) -> Int { wallSecondsAt(epochSeconds, zone) - epochSeconds }
    // Offsets are at most ±14 h, so the zone's offsets around `wall` are those a day either side.
    var offsets: [Int] = []
    for probe in [wall - secondsPerDay, wall, wall + secondsPerDay] {
        let offset = offsetAt(probe)
        if !offsets.contains(offset) { offsets.append(offset) }
    }
    let exact = offsets.map { wall - $0 }
        .filter { $0 > after && wallSecondsAt($0, zone) == wall }
        .sorted()
    if let first = exact.first { return first }
    // The wall time falls in a gap: binary-search the transition that skips it.
    var low = max(after, wall - (offsets.max() ?? 0) - 1)
    var high = wall - (offsets.min() ?? 0)
    while high - low > 1 {
        let middle = floorDivision(low + high, 2)
        if wallSecondsAt(middle, zone) >= wall {
            high = middle
        } else {
            low = middle
        }
    }
    return max(high, after + 1)
}

/// The first instant of the local day after the one `epochSeconds` falls in (§8 step 1).
func nextLocalMidnight(_ epochSeconds: Int, _ zone: TimeZone) -> Int {
    let today = localTimeAt(epochSeconds, zone).dayNumber
    return firstInstantReachingWall(after: epochSeconds, wall: wallSecondsOfDay(today + 1), zone)
}

/// Zones change their offset at most once an hour (in practice twice a year).
private let transitionProbeSeconds = 3600

/// Instants in `(from, to]` at which the zone's UTC offset changes (DST
/// transitions): the first second with the new offset. The wall clock is
/// monotonic between two of them, so a wall time is reached at most once per
/// stretch (a fall-back repeats the hour after the transition).
func offsetTransitionsBetween(_ from: Int, _ to: Int, _ zone: TimeZone) -> [Int] {
    func offsetAt(_ epochSeconds: Int) -> Int { wallSecondsAt(epochSeconds, zone) - epochSeconds }
    var transitions: [Int] = []
    var before = from
    var offset = offsetAt(from)
    while before < to {
        let probe = min(before + transitionProbeSeconds, to)
        if offsetAt(probe) != offset {
            var low = before
            var high = probe
            while high - low > 1 {
                let middle = floorDivision(low + high, 2)
                if offsetAt(middle) == offset {
                    low = middle
                } else {
                    high = middle
                }
            }
            transitions.append(high)
            offset = offsetAt(probe)
        }
        before = probe
    }
    return transitions
}
