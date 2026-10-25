// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB
import MonkiCore

/// The display name of every app seen, by bundle id: events store only the
/// bundle id (the activity key), the "Today" panel shows the name.
public final class AppNameStore {
    private let database: any DatabaseWriter

    public init(database: any DatabaseWriter) {
        self.database = database
    }

    /// Records `app`'s localized name; apps without a bundle id or a name are skipped.
    public func remember(_ app: ForegroundApp, at instant: Int) throws {
        guard let bundleId = app.bundleIdentifier, !bundleId.isEmpty, let name = app.localizedName, !name.isEmpty
        else { return }
        try database.write { db in
            try db.execute(
                sql: """
                    INSERT INTO app_names (bundle_id, localized_name, updated_at) VALUES (?, ?, ?)
                    ON CONFLICT(bundle_id) DO UPDATE SET
                        localized_name = excluded.localized_name, updated_at = excluded.updated_at
                    WHERE localized_name != excluded.localized_name
                    """,
                arguments: [bundleId, name, utcInstantOf(instant)]
            )
        }
    }

    /// The last name recorded for `bundleId`.
    public func name(of bundleId: String) throws -> String? {
        try database.read { db in
            try String.fetchOne(
                db, sql: "SELECT localized_name FROM app_names WHERE bundle_id = ?", arguments: [bundleId])
        }
    }
}
