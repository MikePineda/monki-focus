// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiCore

/// `BypassOutbox` on the `outbox` table. Nothing reads it to send yet: the
/// server sync is a later work package.
public final class GRDBBypassOutbox: BypassOutbox {
    private let database: any DatabaseWriter

    public init(database: any DatabaseWriter) {
        self.database = database
    }

    public func enqueue(_ record: BypassEventRecord, enqueuedAt: String) throws {
        try database.write { db in
            try db.execute(
                sql: "INSERT INTO outbox (kind, payload, enqueued_at) VALUES ('bypass', ?, ?)",
                arguments: [record.jsonText, enqueuedAt]
            )
        }
    }

    /// The queued bypass payloads, oldest first.
    public func pendingBypasses() throws -> [String] {
        try database.read { db in
            try String.fetchAll(db, sql: "SELECT payload FROM outbox WHERE kind = 'bypass' ORDER BY id")
        }
    }
}
