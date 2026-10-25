// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// The instants in `(now, horizon]` at which a decision with fixed inputs can
// change (SEMANTICS.md §5.6). Between two consecutive ones every
// time-dependent check of `decide` keeps its value:
//
// - wall-clock boundaries in each pinned zone: the start and end of every
//   schedule window of a pool rule (`workHours` resolved), of the bedtime
//   window, and local midnights (the budget day); a boundary in a
//   spring-forward gap is reached at the first instant after the gap, and
//   one in a repeated fall-back hour is reached once per pass;
// - the zone's offset transitions themselves (a fall-back puts the wall clock
//   back inside or outside a window);
// - instants of the state: unlock `notBefore` and `expiresAt`, intention and
//   override ends, and `lastActivityAt + 2 h` (the session reset of §7.2
//   changes the next gate).
//
// A superset is harmless: `validUntil` keeps the first candidate at which the
// decision really differs.

/// More than any DST shift: walls beyond the horizon plus this cannot be reached in it.
private let maxWallShiftSeconds = 3 * 3600

/// Local days whose windows can reach into a 24-hour horizon (windows last at most a day).
private let daysBefore = 1
private let daysAfter = 2

private func windowSpecs(of subject: DecisionSubject) -> [Schedule] {
    let schedules = subject.pool.flatMap { resolveSchedules($0.schedules, workHours: subject.ruleset.workHours) }
    return subject.ruleset.bedtime.enabled ? schedules + [subject.ruleset.bedtime.window] : schedules
}

/// Wall seconds of every window start and end, and of local midnights, around today.
private func boundaryWalls(_ specs: [Schedule], today: Int) -> [Int] {
    var walls: [Int] = []
    for day in (today - daysBefore)...(today + daysAfter) {
        walls.append(wallSecondsOfDay(day))
        let weekday = weekdayOfDay(day)
        for spec in specs where spec.startsOn(weekday) {
            let start = wallSecondsOfDay(day) + spec.startMinute * 60
            walls.append(start)
            walls.append(start + spec.lengthMinutes * 60)
        }
    }
    return walls
}

private func wallClockInstants(_ specs: [Schedule], _ zone: TimeZone, nowSeconds: Int, horizon: Int) -> [Int] {
    let transitions = offsetTransitionsBetween(nowSeconds, horizon, zone)
    let walls = boundaryWalls(specs, today: localTimeAt(nowSeconds, zone).dayNumber)
    var instants = transitions
    // The wall clock is monotonic from each anchor to the next transition.
    for anchor in [nowSeconds] + transitions {
        let anchorWall = wallSecondsAt(anchor, zone)
        let lastWall = anchorWall + (horizon - anchor) + maxWallShiftSeconds
        for wall in walls where wall > anchorWall && wall <= lastWall {
            instants.append(firstInstantReachingWall(after: anchor, wall: wall, zone))
        }
    }
    return instants
}

private func stateInstants(_ state: DecisionState) throws -> [Int] {
    var instants: [Int] = []
    for unlock in state.unlocks {
        instants.append(try epochSecondsOf(unlock.notBefore))
        instants.append(try epochSecondsOf(unlock.expiresAt))
    }
    for escalation in state.escalation {
        if let expiresAt = escalation.intentionExpiresAt { instants.append(try epochSecondsOf(expiresAt)) }
        if let endsAt = escalation.overrideEndsAt { instants.append(try epochSecondsOf(endsAt)) }
        if let lastActivityAt = escalation.lastActivityAt {
            instants.append(try epochSecondsOf(lastActivityAt) + sessionQuietSeconds)
        }
    }
    return instants
}

/// Candidate instants in `(now, horizon]`, ascending and without repeats.
func changeInstants(_ subject: DecisionSubject, _ state: DecisionState, nowSeconds: Int, horizon: Int) throws
    -> [Int]
{
    let specs = windowSpecs(of: subject)
    var instants = Set(try stateInstants(state))
    for zone in subject.zones {
        instants.formUnion(wallClockInstants(specs, zone, nowSeconds: nowSeconds, horizon: horizon))
    }
    return instants.filter { $0 > nowSeconds && $0 <= horizon }.sorted()
}
