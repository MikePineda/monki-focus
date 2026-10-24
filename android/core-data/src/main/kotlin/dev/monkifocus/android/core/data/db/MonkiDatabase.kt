// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

/**
 * `monki.db`, version 1 (plan §3.1). The schema of every version is exported
 * to `core-data/schemas/` and committed. Migrations are additive only: a
 * later version adds tables and columns and never drops or renames one in the
 * release that replaces it. Instants are INTEGER epoch milliseconds UTC.
 */
@Database(
    entities = [
        RulesetRevisionEntity::class,
        EscalationStateEntity::class,
        IntentionEntity::class,
        BypassEventEntity::class,
        AwBucketEntity::class,
        AwEventEntity::class,
        ActivityBlockEntity::class,
        UnlockLedgerEntity::class,
        IngestCursorEntity::class,
    ],
    version = MonkiDatabase.VERSION,
    exportSchema = true,
)
@TypeConverters(MonkiTypeConverters::class)
abstract class MonkiDatabase : RoomDatabase() {
    abstract fun rulesetRevisions(): RulesetRevisionDao

    abstract fun escalationStates(): EscalationStateDao

    abstract fun intentions(): IntentionDao

    abstract fun bypassEvents(): BypassEventDao

    abstract fun activityWatch(): ActivityWatchDao

    abstract fun activityBlocks(): ActivityBlockDao

    abstract fun unlockLedger(): UnlockLedgerDao

    abstract fun ingestCursors(): IngestCursorDao

    companion object {
        const val NAME = "monki.db"
        const val VERSION = 1
    }
}
