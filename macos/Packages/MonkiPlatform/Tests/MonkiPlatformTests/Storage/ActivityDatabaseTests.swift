// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import GRDB
import MonkiPlatform
import Testing

/// The on-disk database, in a fresh temporary directory (never the checkout
/// and never the user's Application Support).
@Suite("Activity database")
struct ActivityDatabaseTests {
    private func permissions(_ path: String) throws -> Int {
        try #require(FileManager.default.attributesOfItem(atPath: path)[.posixPermissions] as? Int)
    }

    @Test("the database file is migrated, in WAL mode and readable by the user only")
    func theDatabaseFileIsMigratedInWalModeAndReadableByTheUserOnly() throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "monki-focus-tests-\(UUID().uuidString)", directoryHint: .isDirectory)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appending(path: "store/activity.sqlite")

        let pool = try ActivityDatabase.open(at: url)
        try pool.write { try $0.execute(sql: "INSERT INTO app_names VALUES ('org.example.Editor', 'Editor', 'x')") }

        let mode = try pool.read { try String.fetchOne($0, sql: "PRAGMA journal_mode") }
        #expect(mode == "wal")
        #expect(try pool.read { try MonkiDatabaseMigrator.make().hasCompletedMigrations($0) })
        #expect(try permissions(url.path) == 0o600)
        #expect(try permissions(url.path + "-wal") == 0o600)
        #expect(try permissions(url.deletingLastPathComponent().path) == 0o700)
    }
}
