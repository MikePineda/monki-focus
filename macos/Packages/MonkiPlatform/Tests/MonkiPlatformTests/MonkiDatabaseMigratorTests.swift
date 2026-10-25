// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiPlatform
import Testing

/// Storage runs on GRDB with explicit, additive migrations; every test gets
/// a fresh in-memory `DatabaseQueue` (the `RefreshDatabase` of this stack).
@Suite("Database migrator")
struct MonkiDatabaseMigratorTests {
    @Test("migrations apply in order to an in-memory database")
    func migrationsApplyInOrderToAnInMemoryDatabase() throws {
        let database = try DatabaseQueue()
        let migrator = MonkiDatabaseMigrator.make()

        try migrator.migrate(database)

        let applied = try database.read { try migrator.appliedIdentifiers($0) }
        #expect(applied == Set(MonkiDatabaseMigrator.identifiers))
        #expect(migrator.migrations == MonkiDatabaseMigrator.identifiers)
        #expect(try database.read { try migrator.hasCompletedMigrations($0) })
    }

    @Test("shipped migrations keep their identifiers and order")
    func shippedMigrationsKeepTheirIdentifiersAndOrder() {
        let shipped = ["v1-activity-buckets-events"]

        #expect(Array(MonkiDatabaseMigrator.identifiers.prefix(shipped.count)) == shipped)
    }

    @Test("the schema is never erased to absorb a migration change")
    func theSchemaIsNeverErasedToAbsorbAMigrationChange() {
        #expect(MonkiDatabaseMigrator.make().eraseDatabaseOnSchemaChange == false)
    }

    @Test("buckets and events have the ActivityWatch shape")
    func bucketsAndEventsHaveTheActivityWatchShape() throws {
        let database = try DatabaseQueue()
        try MonkiDatabaseMigrator.make().migrate(database)

        let buckets = try database.read { try $0.columns(in: "buckets").map(\.name) }
        let events = try database.read { try $0.columns(in: "events").map(\.name) }

        #expect(buckets == ["id", "type", "client", "hostname", "device_id", "created"])
        #expect(events == ["id", "bucket_id", "timestamp", "start_at", "duration", "end_at", "data"])
    }

    @Test("events are indexed for range reads by start and by end")
    func eventsAreIndexedForRangeReadsByStartAndByEnd() throws {
        let database = try DatabaseQueue()
        try MonkiDatabaseMigrator.make().migrate(database)

        let indexes = try database.read { try $0.indexes(on: "events") }

        #expect(indexes.contains { $0.columns == ["bucket_id", "start_at"] && $0.isUnique })
        #expect(indexes.contains { $0.columns == ["bucket_id", "end_at"] })
    }
}
