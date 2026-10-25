// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import GRDB
import MonkiCore

/// `EventStore` on the GRDB schema of `MonkiDatabaseMigrator`.
public final class GRDBEventStore: EventStore {
    private let database: any DatabaseWriter
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return encoder
    }()

    public init(database: any DatabaseWriter) {
        self.database = database
    }

    public func register(_ bucket: BucketDescriptor) throws {
        try database.write { db in
            try db.execute(
                sql: """
                    INSERT INTO buckets (id, type, client, hostname, device_id, created) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO NOTHING
                    """,
                arguments: [
                    bucket.id, bucket.type.rawValue, bucket.client, bucket.hostname, bucket.deviceId, bucket.created,
                ]
            )
        }
    }

    /// Every registered bucket, by id.
    public func buckets() throws -> [BucketDescriptor] {
        try database.read { db in
            try Row.fetchAll(db, sql: "SELECT * FROM buckets ORDER BY id").compactMap { row in
                guard let type = ActivityWatchBucketType(rawValue: row["type"]) else { return nil }
                return BucketDescriptor(
                    id: row["id"], type: type, client: row["client"], hostname: row["hostname"],
                    deviceId: row["device_id"], created: row["created"])
            }
        }
    }

    public func lastEvent(bucketId: String) throws -> ActivityEvent? {
        try database.read { db in
            try Row.fetchOne(
                db,
                sql: "SELECT timestamp, duration, data FROM events WHERE bucket_id = ? ORDER BY start_at DESC LIMIT 1",
                arguments: [bucketId]
            ).map(Self.event)
        }
    }

    public func upsert(_ events: [ActivityEvent], bucketId: String) throws {
        let rows = try events.map { event in
            let start = try epochSecondsOf(event.timestamp)
            let data = String(decoding: try encoder.encode(event.data), as: UTF8.self)
            return (event, start, data)
        }
        guard !rows.isEmpty else { return }
        try database.write { db in
            let statement = try db.cachedStatement(
                sql: """
                    INSERT INTO events (bucket_id, timestamp, start_at, duration, end_at, data)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(bucket_id, start_at) DO UPDATE SET
                        timestamp = excluded.timestamp, duration = excluded.duration,
                        end_at = excluded.end_at, data = excluded.data
                    """)
            for (event, start, data) in rows {
                try statement.execute(arguments: [
                    bucketId, event.timestamp, start, event.duration, start + event.duration, data,
                ])
            }
        }
    }

    /// The bucket's events that overlap `[window.start, window.end)` (epoch
    /// seconds), in start order and not clipped: the input of the 5-minute
    /// block aggregation.
    public func events(bucketId: String, overlapping window: Interval) throws -> [ActivityEvent] {
        try database.read { db in
            try Row.fetchAll(
                db,
                sql: """
                    SELECT timestamp, duration, data FROM events
                    WHERE bucket_id = ? AND start_at < ? AND end_at > ?
                    ORDER BY start_at
                    """,
                arguments: [bucketId, window.end, window.start]
            ).map(Self.event)
        }
    }

    /// Every event of the bucket, in start order.
    public func allEvents(bucketId: String) throws -> [ActivityEvent] {
        try events(bucketId: bucketId, overlapping: Interval(start: .min, end: .max))
    }

    private static func event(_ row: Row) throws -> ActivityEvent {
        let json: String = row["data"]
        return ActivityEvent(
            timestamp: row["timestamp"],
            duration: row["duration"],
            data: try JSONDecoder().decode(EventData.self, from: Data(json.utf8))
        )
    }
}
