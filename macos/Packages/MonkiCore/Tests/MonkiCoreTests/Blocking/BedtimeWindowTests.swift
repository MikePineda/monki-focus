// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// Bedtime on the Mac reads the same `bedtime` block as the extension
/// (SEMANTICS.md §6.2, §6.3): a nightly window in the rule set's pinned
/// zone, a warning in the minutes before it, and the stricter outcome while
/// a zone change waits.
@Suite("bedtime window")
struct BedtimeWindowTests {
    /// Monday 22:30 to Tuesday 07:00, warned 30 minutes before.
    private static let mondayNight = Bedtime(
        enabled: true,
        days: [.mon],
        start: TimeOfDay(hour: 22, minute: 30),
        end: TimeOfDay(hour: 7, minute: 0),
        warnMinutesBefore: 30
    )

    private static let zone = "America/New_York"

    private func phase(
        _ instant: String,
        bedtime: Bedtime = mondayNight,
        timeZone: String = zone,
        pendingTimeZone: String? = nil
    ) throws -> BedtimePhase {
        try BedtimeWindow(bedtime: bedtime, timeZone: timeZone, pendingTimeZone: pendingTimeZone)
            .phase(atEpochSeconds: try epochSecondsOf(instant))
    }

    @Test(
        "bedtime window crosses midnight",
        arguments: [
            ("2026-10-26T21:59:00-04:00", BedtimePhase.inactive),
            ("2026-10-26T22:00:00-04:00", .warning),
            ("2026-10-26T22:29:00-04:00", .warning),
            ("2026-10-26T22:30:00-04:00", .active),
            ("2026-10-27T00:00:00-04:00", .active),
            ("2026-10-27T06:59:00-04:00", .active),
            ("2026-10-27T07:00:00-04:00", .inactive),
        ])
    func bedtimeWindowCrossesMidnight(instant: String, expected: BedtimePhase) throws {
        #expect(try phase(instant) == expected)
    }

    @Test("the window only starts on its listed days")
    func theWindowOnlyStartsOnItsListedDays() throws {
        #expect(try phase("2026-10-27T22:00:00-04:00") == .inactive)
        #expect(try phase("2026-10-27T23:00:00-04:00") == .inactive)
    }

    @Test("a disabled bedtime is never active nor warned")
    func aDisabledBedtimeIsNeverActiveNorWarned() throws {
        var disabled = Self.mondayNight
        disabled.enabled = false

        #expect(try phase("2026-10-26T22:10:00-04:00", bedtime: disabled) == .inactive)
        #expect(try phase("2026-10-26T23:00:00-04:00", bedtime: disabled) == .inactive)
    }

    @Test("the window follows the rule set zone, not the device zone")
    func theWindowFollowsTheRuleSetZoneNotTheDeviceZone() throws {
        // 23:00 in New York is 03:00 UTC on Tuesday: inside the New York window only.
        #expect(try phase("2026-10-27T03:00:00Z", timeZone: "America/New_York") == .active)
        #expect(try phase("2026-10-27T03:00:00Z", timeZone: "UTC") == .active)
        #expect(try phase("2026-10-26T23:00:00Z", timeZone: "America/New_York") == .inactive)
        #expect(try phase("2026-10-26T23:00:00Z", timeZone: "UTC") == .active)
    }

    @Test("while a zone change waits bedtime is active in either zone")
    func whileAZoneChangeWaitsBedtimeIsActiveInEitherZone() throws {
        // 19:00 in New York (inactive there) is 23:00 UTC (active in UTC).
        #expect(try phase("2026-10-26T23:00:00Z", timeZone: "America/New_York", pendingTimeZone: "UTC") == .active)
    }

    @Test("while a zone change waits a warning in either zone is a warning")
    func whileAZoneChangeWaitsAWarningInEitherZoneIsAWarning() throws {
        #expect(try phase("2026-10-26T22:10:00Z", timeZone: "America/New_York", pendingTimeZone: "UTC") == .warning)
    }

    @Test("the window reads the bedtime and zones of a rule set")
    func theWindowReadsTheBedtimeAndZonesOfARuleSet() throws {
        let ruleset = Ruleset(
            revision: 1,
            updatedAt: "2026-10-01T00:00:00Z",
            timeZone: Self.zone,
            rules: [],
            categories: [],
            bedtime: Self.mondayNight,
            workHours: Schedule(
                days: [.mon], start: TimeOfDay(hour: 9, minute: 0), end: TimeOfDay(hour: 17, minute: 0))
        )

        let window = BedtimeWindow(ruleset: ruleset)

        #expect(try window.phase(atEpochSeconds: try epochSecondsOf("2026-10-26T23:00:00-04:00")) == .active)
    }

    @Test("an unknown zone throws so the caller decides how to fail")
    func anUnknownZoneThrowsSoTheCallerDecidesHowToFail() {
        #expect(throws: (any Error).self) {
            try phase("2026-10-26T23:00:00Z", timeZone: "Nowhere/Unknown")
        }
    }
}
