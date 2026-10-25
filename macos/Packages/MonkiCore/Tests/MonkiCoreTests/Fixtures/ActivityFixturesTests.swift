// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §10: every `activity` fixture, one test case per fixture id.
/// The output is encoded as JSON and compared with `then` (arrays in order,
/// §1; a missing key differs from a `null` one), like the TypeScript and
/// Kotlin runners.
@Suite("activity fixtures")
struct ActivityFixturesTests {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    @Test("activity", arguments: try FixtureLoader.load("activity"))
    func activity(_ fixture: Fixture) throws {
        let json = try StrictJSONParser.parse(fixture.data)
        let expected = try #require(json["then"])

        let actual = try actualOf(fixture, operation: json["operation"]?.stringValue ?? "")

        #expect(actual == expected)
    }

    private func actualOf(_ fixture: Fixture, operation: String) throws -> JSONValue {
        let catalog = try RulesPackage.catalog()
        switch operation {
        case "heartbeat-merge":
            let given = try fixture.decode(ActivityFixture<HeartbeatMergeGiven>.self).given
            return try json([
                "events": mergeHeartbeats(given.events, heartbeats: given.heartbeats, pulsetime: given.pulsetime)
            ])
        case "probe":
            let given = try fixture.decode(ActivityFixture<TabProbeInput>.self).given
            return try json(["heartbeat": probeTab(given, catalog: catalog)])
        case "active-time":
            let given = try fixture.decode(ActivityFixture<ActiveTimeGiven>.self).given
            return try json(["events": activeTime(given.events, afk: given.afk)])
        case "categorise":
            let given = try fixture.decode(ActivityFixture<CategoriseGiven>.self).given
            return try json(
                categorise(
                    given.activity, assignments: given.assignments, catalog: catalog,
                    includeDefaults: given.includeDefaults))
        case "pulse":
            let given = try fixture.decode(ActivityFixture<PulseGiven>.self).given
            return try json(["pulse": pulse(given.entries)])
        case "blocks":
            let given = try fixture.decode(ActivityFixture<BlocksGiven>.self).given
            let options = BlockOptions(deviceId: given.deviceId, syncActivityKey: given.syncActivityKey)
            return try json(["blocks": toBlocks(given.events, options: options)])
        case "daily-totals":
            let given = try fixture.decode(ActivityFixture<DailyTotalsGiven>.self).given
            return try json(["days": dailyTotals(given.entries, timeZone: given.timeZone)])
        case "browser-dedupe":
            let given = try fixture.decode(ActivityFixture<BrowserDedupeInput>.self).given
            return try json(["segments": dedupeBrowserTime(given)])
        case "cross-device-cap":
            let given = try fixture.decode(ActivityFixture<CrossDeviceCapGiven>.self).given
            return try json(["blocks": capAcrossDevices(given.blocks)])
        default:
            throw Failure(description: "Unknown activity operation: \(operation)")
        }
    }

    private func json(_ value: some Encodable) throws -> JSONValue {
        try StrictJSONParser.parse(JSONEncoder().encode(value))
    }
}
