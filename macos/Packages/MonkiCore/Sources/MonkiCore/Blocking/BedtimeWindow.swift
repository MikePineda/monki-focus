// SPDX-License-Identifier: AGPL-3.0-or-later

/// The rule set's bedtime as the Mac evaluates it (SEMANTICS.md §6.2, §6.3):
/// the same `bedtime` block and pinned zone(s) as the extension. While a zone
/// change waits, bedtime is active (or warned) when it is in either zone.
public struct BedtimeWindow: Hashable, Sendable {
    public let bedtime: Bedtime
    public let timeZones: [String]

    public init(bedtime: Bedtime, timeZone: String, pendingTimeZone: String? = nil) {
        self.bedtime = bedtime
        timeZones = zoneNamesOf(timeZone: timeZone, pendingTimeZone: pendingTimeZone)
    }

    public init(ruleset: Ruleset) {
        self.init(bedtime: ruleset.bedtime, timeZone: ruleset.timeZone, pendingTimeZone: ruleset.pendingTimeZone)
    }

    /// The phase at an instant; throws on a zone the database cannot resolve.
    public func phase(atEpochSeconds epochSeconds: Int) throws -> BedtimePhase {
        var phases: [BedtimePhase] = []
        for name in timeZones {
            phases.append(bedtimePhaseAt(bedtime, epochSeconds, try ZoneLookup.zone(named: name)))
        }
        if phases.contains(.active) { return .active }
        return phases.contains(.warning) ? .warning : .inactive
    }
}
