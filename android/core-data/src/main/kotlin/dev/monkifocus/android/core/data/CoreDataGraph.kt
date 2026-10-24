// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data

import android.app.usage.UsageStatsManager
import android.content.Context
import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.MonkiDatabaseFactory
import dev.monkifocus.android.core.data.repository.RoomActivityEventRepository
import dev.monkifocus.android.core.data.repository.RoomBlockRepository
import dev.monkifocus.android.core.data.repository.RoomBypassEventOutbox
import dev.monkifocus.android.core.data.repository.RoomEscalationStateRepository
import dev.monkifocus.android.core.data.repository.RoomIngestCursorRepository
import dev.monkifocus.android.core.data.repository.RoomIntentionRepository
import dev.monkifocus.android.core.data.repository.RoomRulesetRepository
import dev.monkifocus.android.core.data.repository.RoomUnlockLedgerRepository
import dev.monkifocus.android.core.data.settings.DataStoreSettingsRepository
import dev.monkifocus.android.core.data.settings.SettingsDataStoreFactory
import dev.monkifocus.android.core.data.usage.UsageEventsSource
import dev.monkifocus.android.core.data.usage.UsageStatsEventsSource
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.ports.BlockRepository
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.ports.IngestCursorRepository
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.core.domain.ports.RulesetRepository
import dev.monkifocus.android.core.domain.ports.UnlockLedgerRepository

/**
 * The data layer's part of the composition root: one database, one settings
 * store and one instance of each repository per process, each created on
 * first use. `AppGraph` holds a single instance of this class.
 */
class CoreDataGraph(
    context: Context,
) {
    private val appContext: Context = context.applicationContext

    val database: MonkiDatabase by lazy { MonkiDatabaseFactory.open(appContext) }

    val settings: DataStoreSettingsRepository by lazy { DataStoreSettingsRepository(SettingsDataStoreFactory.open(appContext)) }

    val rulesets: RulesetRepository by lazy { RoomRulesetRepository(database.rulesetRevisions()) }

    val escalationStates: EscalationStateRepository by lazy { RoomEscalationStateRepository(database.escalationStates()) }

    val intentions: IntentionRepository by lazy { RoomIntentionRepository(database.intentions()) }

    val bypassEvents: BypassEventOutbox by lazy { RoomBypassEventOutbox(database.bypassEvents()) }

    val activityEvents: ActivityEventRepository by lazy { RoomActivityEventRepository(database.activityWatch(), settings) }

    val blocks: BlockRepository by lazy { RoomBlockRepository(database.activityBlocks()) }

    val unlockLedger: UnlockLedgerRepository by lazy { RoomUnlockLedgerRepository(database.unlockLedger()) }

    val ingestCursors: IngestCursorRepository by lazy { RoomIngestCursorRepository(database.ingestCursors()) }

    val usageEvents: UsageEventsSource by lazy {
        UsageStatsEventsSource(requireNotNull(appContext.getSystemService(UsageStatsManager::class.java)) { "No UsageStatsManager" })
    }
}
