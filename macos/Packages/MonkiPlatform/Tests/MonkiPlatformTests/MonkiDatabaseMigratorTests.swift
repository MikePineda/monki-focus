// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiPlatform
import Testing

/// Storage runs on GRDB with explicit, additive migrations; every test gets
/// a fresh in-memory `DatabaseQueue` (the `RefreshDatabase` of this stack).
@Suite("Database migrator")
struct MonkiDatabaseMigratorTests {
    @Test("an empty migrator migrates an in-memory database")
    func anEmptyMigratorMigratesAnInMemoryDatabase() throws {
        let database = try DatabaseQueue()
        let migrator = MonkiDatabaseMigrator.make()

        try migrator.migrate(database)

        let applied = try database.read { try migrator.appliedIdentifiers($0) }
        #expect(applied.isEmpty)
        #expect(try database.read { try migrator.hasCompletedMigrations($0) })
    }

    @Test("the schema is never erased to absorb a migration change")
    func theSchemaIsNeverErasedToAbsorbAMigrationChange() {
        #expect(MonkiDatabaseMigrator.make().eraseDatabaseOnSchemaChange == false)
    }
}
