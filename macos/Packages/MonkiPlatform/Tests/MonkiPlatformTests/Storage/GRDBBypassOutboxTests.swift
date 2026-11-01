// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiCore
import MonkiPlatform
import Testing

/// Bypass events wait in the local outbox for the later server sync.
@Suite("bypass outbox")
struct GRDBBypassOutboxTests {
    private static let grant = EmergencyGrant(group: "r-games", waited: .seconds(120), access: .seconds(900))

    private func outbox() throws -> (GRDBBypassOutbox, DatabaseQueue) {
        let database = try DatabaseQueue()
        try MonkiDatabaseMigrator.make().migrate(database)
        return (GRDBBypassOutbox(database: database), database)
    }

    @Test("the outbox migration is additive and keeps the shipped one first")
    func theOutboxMigrationIsAdditiveAndKeepsTheShippedOneFirst() throws {
        let (_, database) = try outbox()

        let columns = try database.read { try $0.columns(in: "outbox").map(\.name) }

        #expect(MonkiDatabaseMigrator.identifiers == ["v1-activity-buckets-events", "v2-outbox"])
        #expect(columns == ["id", "kind", "payload", "enqueued_at"])
    }

    @Test("a bypass event is queued with its contract JSON")
    func aBypassEventIsQueuedWithItsContractJson() throws {
        let (outbox, database) = try outbox()
        let record = try #require(
            BypassEventRecord.emergencyOverride(Self.grant, occurredAt: "2026-10-26T10:02:00Z", dedupeKey: "k1"))

        try outbox.enqueue(record, enqueuedAt: "2026-10-26T10:02:00Z")

        let rows = try database.read { try Row.fetchAll($0, sql: "SELECT kind, payload, enqueued_at FROM outbox") }
        #expect(rows.count == 1)
        #expect(rows.first?["kind"] == "bypass")
        #expect(rows.first?["payload"] == record.jsonText)
        #expect(rows.first?["enqueued_at"] == "2026-10-26T10:02:00Z")
        #expect(try outbox.pendingBypasses() == [record.jsonText])
    }

    @Test("only bypass rows are accepted by the outbox table")
    func onlyBypassRowsAreAcceptedByTheOutboxTable() throws {
        let (_, database) = try outbox()

        #expect(throws: DatabaseError.self) {
            try database.write {
                try $0.execute(
                    sql:
                        "INSERT INTO outbox (kind, payload, enqueued_at) VALUES ('title', '{}', '2026-10-26T10:02:00Z')"
                )
            }
        }
    }
}
