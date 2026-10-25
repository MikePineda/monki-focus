// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiCore
import MonkiPlatform

/// The GRDB store on a fresh in-memory database, counting batch writes and
/// failing them while `failing` is set.
final class RecordingEventStore: EventStore {
    struct WriteFailure: Error {}

    let database: DatabaseQueue
    let store: GRDBEventStore
    private(set) var writes = 0
    var failing = false

    init(database: DatabaseQueue? = nil) throws {
        let database = try database ?? DatabaseQueue()
        try MonkiDatabaseMigrator.make().migrate(database)
        self.database = database
        store = GRDBEventStore(database: database)
    }

    func register(_ bucket: BucketDescriptor) throws {
        try store.register(bucket)
    }

    func lastEvent(bucketId: String) throws -> ActivityEvent? {
        try store.lastEvent(bucketId: bucketId)
    }

    func upsert(_ events: [ActivityEvent], bucketId: String) throws {
        if failing { throw WriteFailure() }
        writes += 1
        try store.upsert(events, bucketId: bucketId)
    }

    func events(_ bucketId: String) throws -> [ActivityEvent] {
        try store.allEvents(bucketId: bucketId)
    }
}
