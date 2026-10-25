// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiCore
import MonkiPlatform
import Testing

@Suite("GRDB event store")
struct GRDBEventStoreTests {
    private typealias E = SampleEvents

    private let database: DatabaseQueue
    private let store: GRDBEventStore
    private let bucket = SampleEvents.bucket(.currentWindow)

    init() throws {
        database = try DatabaseQueue()
        try MonkiDatabaseMigrator.make().migrate(database)
        store = GRDBEventStore(database: database)
        try store.register(bucket)
    }

    @Test("registering a bucket twice keeps the first one")
    func registeringABucketTwiceKeepsTheFirstOne() throws {
        var later = bucket
        later.created = "2027-01-01T00:00:00Z"

        try store.register(later)

        #expect(try store.buckets() == [bucket])
    }

    @Test("an upsert on the same start replaces the event")
    func anUpsertOnTheSameStartReplacesTheEvent() throws {
        try store.upsert([E.event(0, 10, E.window(SampleApps.editor))], bucketId: bucket.id)

        try store.upsert(
            [E.event(0, 25, E.window(SampleApps.editor)), E.event(25, 0, E.window(SampleApps.browser))],
            bucketId: bucket.id)

        #expect(
            try store.allEvents(bucketId: bucket.id) == [
                E.event(0, 25, E.window(SampleApps.editor)), E.event(25, 0, E.window(SampleApps.browser)),
            ])
    }

    @Test("the last event is the latest by start")
    func theLastEventIsTheLatestByStart() throws {
        try store.upsert(
            [E.event(30, 5, E.window(SampleApps.browser)), E.event(0, 30, E.window(SampleApps.editor))],
            bucketId: bucket.id)

        #expect(try store.lastEvent(bucketId: bucket.id) == E.event(30, 5, E.window(SampleApps.browser)))
        #expect(try store.lastEvent(bucketId: "monki-afk_test-host") == nil)
    }

    @Test("a window read returns the events overlapping it, unclipped")
    func aWindowReadReturnsTheEventsOverlappingItUnclipped() throws {
        try store.upsert(
            [
                E.event(0, 290, E.window(SampleApps.editor)), E.event(290, 20, E.window(SampleApps.browser)),
                E.event(310, 290, E.window(SampleApps.terminal)), E.event(600, 5, E.window(SampleApps.editor)),
            ], bucketId: bucket.id)

        let block = Interval(start: FakeTime.origin + 300, end: FakeTime.origin + 600)

        #expect(
            try store.events(bucketId: bucket.id, overlapping: block) == [
                E.event(290, 20, E.window(SampleApps.browser)), E.event(310, 290, E.window(SampleApps.terminal)),
            ])
    }

    @Test("the block window read uses an index, not a table scan")
    func theBlockWindowReadUsesAnIndexNotATableScan() throws {
        let plan = try database.read { db in
            try Row.fetchAll(
                db,
                sql: """
                    EXPLAIN QUERY PLAN SELECT timestamp, duration, data FROM events
                    WHERE bucket_id = ? AND start_at < ? AND end_at > ? ORDER BY start_at
                    """,
                arguments: [bucket.id, 1, 0]
            ).map { $0["detail"] as String }
        }

        #expect(plan.contains { $0.contains("USING INDEX events_by_bucket") })
        #expect(!plan.contains { $0.hasPrefix("SCAN events") && !$0.contains("INDEX") })
    }

    @Test("titles round-trip only when they were recorded")
    func titlesRoundTripOnlyWhenTheyWereRecorded() throws {
        let titled = E.event(0, 5, E.window(SampleApps.editor, title: "Draft notes"))
        let untitled = E.event(5, 5, E.window(SampleApps.browser))

        try store.upsert([titled, untitled], bucketId: bucket.id)

        let stored = try database.read { try String.fetchAll($0, sql: "SELECT data FROM events ORDER BY start_at") }
        #expect(stored == [#"{"app":"org.example.Editor","title":"Draft notes"}"#, #"{"app":"org.example.Browser"}"#])
        #expect(try store.allEvents(bucketId: bucket.id) == [titled, untitled])
    }

    @Test("an event whose end disagrees with its duration is refused")
    func anEventWhoseEndDisagreesWithItsDurationIsRefused() throws {
        #expect(throws: DatabaseError.self) {
            try database.write { db in
                try db.execute(
                    sql: """
                        INSERT INTO events (bucket_id, timestamp, start_at, duration, end_at, data)
                        VALUES (?, '2026-10-26T00:00:00Z', 0, 5, 9, '{}')
                        """, arguments: [bucket.id])
            }
        }
    }

    @Test("app names are remembered by bundle id")
    func appNamesAreRememberedByBundleId() throws {
        let names = AppNameStore(database: database)

        try names.remember(SampleApps.editor.app, at: FakeTime.origin)
        try names.remember(
            ForegroundApp(bundleIdentifier: "org.example.Editor", localizedName: "Editor Pro"), at: FakeTime.origin + 5)
        try names.remember(ForegroundApp(bundleIdentifier: nil, localizedName: "Tool"), at: FakeTime.origin)

        #expect(try names.name(of: "org.example.Editor") == "Editor Pro")
        #expect(try database.read { try Int.fetchOne($0, sql: "SELECT COUNT(*) FROM app_names") } == 1)
    }
}
