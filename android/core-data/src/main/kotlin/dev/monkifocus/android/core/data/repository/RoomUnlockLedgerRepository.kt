// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.UnlockLedgerDao
import dev.monkifocus.android.core.data.db.UnlockLedgerEntity
import dev.monkifocus.android.core.domain.ports.UnlockLedgerEntry
import dev.monkifocus.android.core.domain.ports.UnlockLedgerRepository

/** [UnlockLedgerRepository] over `unlock_ledger`. */
class RoomUnlockLedgerRepository(
    private val dao: UnlockLedgerDao,
) : UnlockLedgerRepository {
    override suspend fun get(jti: String): UnlockLedgerEntry? = dao.get(jti)?.toDomain()

    override suspend fun all(): List<UnlockLedgerEntry> = dao.all().map { it.toDomain() }

    override suspend fun insert(entry: UnlockLedgerEntry): Boolean = dao.insertOrIgnore(UnlockLedgerEntity.of(entry)) != IGNORED

    override suspend fun update(entry: UnlockLedgerEntry): Boolean = dao.update(UnlockLedgerEntity.of(entry)) > 0

    override suspend fun delete(jtis: List<String>): Int = if (jtis.isEmpty()) 0 else dao.delete(jtis)

    private companion object {
        const val IGNORED = -1L
    }
}
