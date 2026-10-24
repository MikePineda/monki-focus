// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.RulesetRevisionDao
import dev.monkifocus.android.core.data.db.RulesetRevisionEntity
import dev.monkifocus.android.core.data.db.instantOfMillis
import dev.monkifocus.android.core.data.db.millisOf
import dev.monkifocus.android.core.domain.ports.RulesetChange
import dev.monkifocus.android.core.domain.ports.RulesetRepository
import dev.monkifocus.android.core.domain.ports.StoredRuleset
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * [RulesetRepository] over `ruleset_revision`. Commits are serialised by a
 * mutex (one writer in the process) and each is one database transaction.
 */
class RoomRulesetRepository(
    private val dao: RulesetRevisionDao,
) : RulesetRepository {
    private val writer = Mutex()

    override suspend fun active(now: String): StoredRuleset? = dao.active(millisOf(now))?.toDomain()

    override suspend fun pending(now: String): StoredRuleset? = dao.pending(millisOf(now))?.toDomain()

    override suspend fun commit(
        change: RulesetChange,
        now: String,
    ): String {
        val nowMillis = millisOf(now)
        val nextFrom = change.effectiveFrom?.let(::millisOf) ?: nowMillis
        val today = change.effectiveFrom?.let { RulesetRevisionEntity.of(change.effectiveToday, change.source, nowMillis, nowMillis) }
        val next = RulesetRevisionEntity.of(change.next, change.source, nowMillis, nextFrom)
        return writer.withLock { instantOfMillis(dao.commit(today, next, nowMillis)) }
    }
}
