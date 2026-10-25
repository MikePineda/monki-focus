// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import GRDB

/// Opens the on-disk activity database: WAL (a `DatabasePool`), migrated,
/// readable by the user only (directory 0700, files 0600, threat model
/// "analytics at rest"). Tests use an in-memory `DatabaseQueue()` instead.
public enum ActivityDatabase {
    /// `~/Library/Application Support/monki-focus/activity.sqlite`.
    public static func defaultURL() throws -> URL {
        try FileManager.default
            .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appending(path: "monki-focus/activity.sqlite", directoryHint: .notDirectory)
    }

    public static func open(at url: URL) throws -> DatabasePool {
        let directory = url.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
        // SQLite gives the -wal and -shm files the main file's mode, so the
        // main file exists with 0600 before SQLite first opens it.
        if !FileManager.default.fileExists(atPath: url.path) {
            FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.posixPermissions: 0o600])
        }
        let pool = try DatabasePool(path: url.path)
        try MonkiDatabaseMigrator.make().migrate(pool)
        for suffix in ["", "-wal", "-shm"] where FileManager.default.fileExists(atPath: url.path + suffix) {
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path + suffix)
        }
        return pool
    }
}
