// SPDX-License-Identifier: AGPL-3.0-or-later

import GRDB

/// The app database schema as an ordered list of GRDB migrations.
///
/// Migrations are additive: add tables and columns; drop or rename only in a
/// later release, and never edit a migration that has shipped. The schema
/// is never erased to absorb a changed migration, not even in debug builds,
/// so a mistake shows up as a failing migration instead of lost history.
/// Tables (`buckets`, `events`, `blocks`, ...) arrive with work package M4.
public enum MonkiDatabaseMigrator {
    public static func make() -> DatabaseMigrator {
        DatabaseMigrator()
    }
}
