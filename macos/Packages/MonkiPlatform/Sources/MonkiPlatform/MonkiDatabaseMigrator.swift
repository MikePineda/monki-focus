// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB

/// The app database schema as an ordered list of GRDB migrations.
///
/// Migrations are additive: add tables and columns; drop or rename only in
/// a later release, and never edit a migration that has shipped. The schema
/// is never erased to absorb a changed migration, not even in debug builds,
/// so a mistake shows up as a failing migration instead of lost history.
public enum MonkiDatabaseMigrator {
    /// Every migration identifier, in order. A shipped identifier never
    /// changes or moves; new ones are appended.
    public static let identifiers = ["v1-activity-buckets-events"]

    public static func make() -> DatabaseMigrator {
        var migrator = DatabaseMigrator()
        migrator.registerMigration("v1-activity-buckets-events", migrate: createActivityTables)
        return migrator
    }

    /// ActivityWatch-compatible buckets and events (plan §3.1). An event
    /// keeps the AW `timestamp` text (canonical UTC) and `data` JSON, plus
    /// its start and end in epoch seconds for range queries: the 5-minute
    /// block aggregation reads the events of a bucket that overlap a window
    /// (`start_at < :to AND end_at > :from`). `(bucket_id, start_at)` is
    /// unique: the heartbeat queue upserts on it.
    private static func createActivityTables(_ db: Database) throws {
        try db.create(table: "buckets") { table in
            table.primaryKey("id", .text)
            table.column("type", .text).notNull()
            table.column("client", .text).notNull()
            table.column("hostname", .text).notNull()
            table.column("device_id", .text).notNull()
            table.column("created", .text).notNull()
        }
        try db.create(table: "events") { table in
            table.autoIncrementedPrimaryKey("id")
            table.column("bucket_id", .text).notNull().references("buckets", onDelete: .cascade)
            table.column("timestamp", .text).notNull()
            table.column("start_at", .integer).notNull()
            table.column("duration", .integer).notNull().check { $0 >= 0 }
            table.column("end_at", .integer).notNull()
            table.column("data", .text).notNull()
            table.check(sql: "end_at = start_at + duration")
        }
        try db.create(index: "events_by_bucket_start", on: "events", columns: ["bucket_id", "start_at"], unique: true)
        try db.create(index: "events_by_bucket_end", on: "events", columns: ["bucket_id", "end_at"])
        // Display names of the apps seen, by bundle id (events store only the id).
        try db.create(table: "app_names") { table in
            table.primaryKey("bundle_id", .text)
            table.column("localized_name", .text).notNull()
            table.column("updated_at", .text).notNull()
        }
    }
}
