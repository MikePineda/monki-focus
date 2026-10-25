// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

@testable import MonkiCore

/// The analytics concepts the shared fixtures do not pin down on their own.
@Suite("analytics concepts")
struct AnalyticsConceptsTests {
    private static let domain = "example.org"
    private static let privateUrl = "https://example.org/private"
    private static let threadTitle = "Weekly discussion thread"

    private static func block(
        deviceId: String = "device-a",
        blockStart: String = "2026-10-26T09:00:00Z",
        activityKey: String? = domain,
        categoryPath: String = "reference",
        level: Int = 75,
        source: ActivitySource = .web,
        seconds: Int = 60
    ) throws -> SyncBlock {
        try SyncBlock(
            deviceId: deviceId, blockStart: blockStart, activityKey: activityKey, categoryPath: categoryPath,
            level: level, source: source, seconds: seconds)
    }

    @Test("a sync block has exactly the seven synced fields")
    func aSyncBlockHasExactlyTheSevenSyncedFields() throws {
        let json = try StrictJSONParser.parse(JSONEncoder().encode(try Self.block(activityKey: nil)))

        guard case .object(let members) = json else { throw CocoaError(.coderInvalidValue) }
        #expect(members.keys.sorted() == SyncBlock.fields.sorted())
        #expect(
            SyncBlock.fields == ["deviceId", "blockStart", "activityKey", "categoryPath", "level", "source", "seconds"])
        #expect(members["activityKey"] == .null)
    }

    @Test("a sync block field that does not fit the schema is rejected")
    func aSyncBlockFieldThatDoesNotFitTheSchemaIsRejected() {
        let cases: [(String, () throws -> SyncBlock)] = [
            ("deviceId", { try Self.block(deviceId: "device a") }),
            ("blockStart", { try Self.block(blockStart: "2026-10-26T09:03:00Z") }),
            ("blockStart", { try Self.block(blockStart: "2026-10-26T09:00:00Z\n") }),
            ("activityKey", { try Self.block(activityKey: Self.privateUrl) }),
            ("activityKey", { try Self.block(activityKey: Self.threadTitle) }),
            ("categoryPath", { try Self.block(categoryPath: "Social Media") }),
            ("categoryPath", { try Self.block(categoryPath: "a" + String(repeating: "/b", count: 48)) }),
            ("level", { try Self.block(level: 60) }),
            ("seconds", { try Self.block(seconds: 0) }),
            ("seconds", { try Self.block(seconds: 301) }),
        ]

        for (field, make) in cases {
            #expect(throws: AnalyticsError.invalidSyncBlock(field)) { try make() }
        }
    }

    @Test("decoding a block goes through the same checks")
    func decodingABlockGoesThroughTheSameChecks() throws {
        let valid = try String(decoding: JSONEncoder().encode(try Self.block()), as: UTF8.self)
        let leaky = valid.replacingOccurrences(of: Self.domain, with: Self.privateUrl)

        #expect(try StrictJSONDecoder().decode(SyncBlock.self, from: valid) == (try Self.block()))
        #expect(throws: AnalyticsError.invalidSyncBlock("activityKey")) {
            try StrictJSONDecoder().decode(SyncBlock.self, from: leaky)
        }
    }

    @Test("canonical block order puts a nil activity key first and is total")
    func canonicalBlockOrderPutsANilActivityKeyFirstAndIsTotal() throws {
        let blocks = [
            try Self.block(deviceId: "device-a", activityKey: Self.domain),
            try Self.block(deviceId: "device-a", activityKey: nil),
            try Self.block(deviceId: "device-0"),
            try Self.block(blockStart: "2026-10-26T08:55:00Z"),
            try Self.block(source: .app),
            try Self.block(level: 50),
        ]

        let sorted = blocks.sorted { SyncBlock.compare($0, $1) < 0 }

        #expect(sorted.map(\.blockStart).first == "2026-10-26T08:55:00Z")
        #expect(sorted[1].deviceId == "device-0")
        #expect(sorted[2].activityKey == nil)
        #expect(sorted[3].source == .app)
        #expect(sorted[4].level == 50)
        for (lhs, rhs) in zip(sorted, sorted.dropFirst()) { #expect(SyncBlock.compare(lhs, rhs) < 0) }
    }

    @Test("code-unit order is not locale order and nil sorts first")
    func codeUnitOrderIsNotLocaleOrderAndNilSortsFirst() {
        #expect(CodeUnitOrder.compareNullable(nil, "a") < 0)
        #expect(CodeUnitOrder.compareNullable("a", nil) > 0)
        #expect(CodeUnitOrder.compareNullable(nil, nil) == 0)
        #expect(CodeUnitOrder.compareNullable("Z", "a") < 0)
        // U+1F600 is the surrogate pair 0xD83D 0xDE00, so it sorts before U+FF5E by code unit (not by scalar).
        #expect(CodeUnitOrder.compareNullable("\u{1F600}", "\u{FF5E}") < 0)
    }

    @Test("largest remainder keeps the input order and sums to the cap")
    func largestRemainderKeepsTheInputOrderAndSumsToTheCap() throws {
        let drafts = [100, 100, 100, 1].enumerated().map { index, seconds in
            BlockDraft(
                deviceId: "device-\(index)", blockStart: "2026-10-26T09:00:00Z", activityKey: nil,
                categoryPath: "reference", level: 75, source: .web, seconds: seconds)
        }

        let scaled = scaleToCap(drafts, cap: 300, tieOrder: BlockDraft.compare)

        #expect(scaled.map(\.deviceId) == drafts.map(\.deviceId))
        #expect(scaled.reduce(0) { $0 + $1.seconds } == 300)
        // 100 × 300 / 301 = 99.67 each (remainder 201), 1 × 300 / 301 = 0.997 (remainder 300) gets one first.
        #expect(scaled.map(\.seconds) == [100, 100, 99, 1])
    }

    @Test("a block scaled to zero is dropped")
    func aBlockScaledToZeroIsDropped() throws {
        let blocks = [
            try Self.block(deviceId: "device-a", seconds: 300),
            try Self.block(deviceId: "device-b", seconds: 300),
            try Self.block(deviceId: "device-c", seconds: 1),
        ]

        let capped = try capAcrossDevices(blocks)

        #expect(capped.map(\.deviceId) == ["device-a", "device-b"])
        #expect(capped.map(\.seconds) == [150, 150])
    }

    @Test("union merges overlapping and touching intervals and drops empty ones")
    func unionMergesOverlappingAndTouchingIntervalsAndDropsEmptyOnes() {
        let union = unionIntervals([
            Interval(start: 10, end: 20), Interval(start: 0, end: 5), Interval(start: 5, end: 8),
            Interval(start: 15, end: 25), Interval(start: 30, end: 30),
        ])

        #expect(union == [Interval(start: 0, end: 8), Interval(start: 10, end: 25)])
    }

    @Test("subtract leaves the uncovered pieces in order and can remove everything")
    func subtractLeavesTheUncoveredPiecesInOrderAndCanRemoveEverything() {
        #expect(
            subtractIntervals(
                [Interval(start: 0, end: 100)], [Interval(start: 90, end: 120), Interval(start: 10, end: 20)])
                == [Interval(start: 0, end: 10), Interval(start: 20, end: 90)])
        #expect(subtractIntervals([Interval(start: 0, end: 10)], [Interval(start: -5, end: 15)]).isEmpty)
    }

    @Test("heartbeat at exactly pulsetime after the end still extends, before the start opens a new event")
    func heartbeatAtExactlyPulsetimeAfterTheEndStillExtends() throws {
        let data = EventData.window(WindowData(app: "org.example.Editor"))
        let last = ActivityEvent(timestamp: "2026-10-26T09:00:00Z", duration: 60, data: data)

        let late = try heartbeat(
            last: last, next: ActivityEvent(timestamp: "2026-10-26T09:01:10Z", duration: 0, data: data), pulsetime: 10)
        let early = try heartbeat(
            last: last, next: ActivityEvent(timestamp: "2026-10-26T08:59:59Z", duration: 0, data: data), pulsetime: 10)
        let inside = try heartbeat(
            last: last, next: ActivityEvent(timestamp: "2026-10-26T09:00:10Z", duration: 5, data: data), pulsetime: 10)
        let titled = try heartbeat(
            last: last,
            next: ActivityEvent(
                timestamp: "2026-10-26T09:00:10Z", duration: 5,
                data: .window(WindowData(app: "org.example.Editor", title: "Draft"))),
            pulsetime: 10)

        #expect(late?.duration == 70)
        #expect(early == nil)
        #expect(inside?.duration == 60)
        #expect(titled == nil)
    }

    @Test("an unknown time zone fails loudly")
    func anUnknownTimeZoneFailsLoudly() {
        let entries = [LevelledInterval(timestamp: "2026-10-26T09:00:00Z", duration: 60, level: 50)]

        #expect(throws: EngineError.unknownTimeZone) { try dailyTotals(entries, timeZone: "Mars/Olympus_Mons") }
        #expect(throws: AnalyticsError.invalidLevel(60)) {
            try dailyTotals(
                [LevelledInterval(timestamp: "2026-10-26T09:00:00Z", duration: 60, level: 60)], timeZone: "UTC")
        }
    }

    @Test("categorise and the bedtime level share one ranking for a known path")
    func categoriseAndTheBedtimeLevelShareOneRankingForAKnownPath() throws {
        let catalog = try RulesPackage.catalog()
        let assignments = [
            CategoryAssignment(target: .site(domain: "youtube.com", path: nil), level: 100, category: "video"),
            CategoryAssignment(
                target: .site(domain: "example.org", path: "/docs/**"), level: 75, category: "reference"),
        ]
        let web: [(String, String, String?)] = [
            ("youtube.com", "/shorts/abc", "youtube.shorts"), ("youtube.com", "/watch", "youtube.watch"),
            ("example.org", "/docs/a", nil),
        ]
        let activities =
            web.map { CategorisableActivity(source: .web, activityKey: $0.0, path: $0.1, surface: $0.2) }
            + [
                CategorisableActivity(
                    source: .app, activityKey: ActivityGenerator.activityKeys[2], path: nil, surface: nil)
            ]

        for activity in activities {
            let observation: ResolvedObservation =
                activity.source == .web
                ? .site(
                    host: activity.activityKey, path: activity.path ?? "/", pathKnown: true, surface: activity.surface)
                : .app(package: activity.activityKey, surface: activity.surface)
            #expect(
                categorise(activity, assignments: assignments, catalog: catalog).level
                    == categoryLevelOf(observation, userAssignments: assignments, catalog))
        }
    }
}
