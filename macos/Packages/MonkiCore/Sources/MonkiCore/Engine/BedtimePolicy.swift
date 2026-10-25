// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// Bedtime (SEMANTICS.md §6.2): `active` inside the nightly window, `warning`
// during the `warnMinutesBefore` minutes before a listed start, otherwise
// `inactive`. In `decide` bedtime blocks targets of category level ≤ 25
// (§5.2.1) and is active when it is active in any pinned zone (§6.3).

/// Highest category level bedtime blocks.
let bedtimeMaxLevel = 25

/// The escalation group of emergency overrides requested from the bedtime screen.
let bedtimeGroup = "bedtime"

func bedtimePhaseAt(_ bedtime: Bedtime, _ epochSeconds: Int, _ zone: TimeZone) -> BedtimePhase {
    guard bedtime.enabled else { return .inactive }
    let local = localTimeAt(epochSeconds, zone)
    let window = bedtime.window
    if window.occurrence(at: local) != nil { return .active }
    return window.isInLeadUp(at: local, minutesBefore: bedtime.warnMinutesBefore) ? .warning : .inactive
}

public func bedtimePhase(_ bedtime: Bedtime, now: String, timeZone: String) throws -> BedtimePhase {
    let seconds = try epochSecondsOf(now)
    return bedtimePhaseAt(bedtime, seconds, try ZoneLookup.zone(named: timeZone))
}

/// Bedtime is active when it is active in any of the pinned zones (§6.3).
func isBedtimeActive(_ bedtime: Bedtime, _ epochSeconds: Int, zones: [TimeZone]) -> Bool {
    zones.contains { bedtimePhaseAt(bedtime, epochSeconds, $0) == .active }
}
