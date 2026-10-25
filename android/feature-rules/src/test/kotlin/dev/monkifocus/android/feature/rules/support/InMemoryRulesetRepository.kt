// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.support

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.RulesetChange
import dev.monkifocus.android.core.domain.ports.RulesetRepository
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.ports.StoredRuleset
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * [RulesetRepository] in memory with the semantics of the Room one
 * (`RulesetRevisionDao.commit`): append-only revisions, at most one pending,
 * and a pending `effectiveFrom` never moved earlier by a later change.
 * Thread-safe, so a Compose test can read it while the screen writes.
 */
class InMemoryRulesetRepository(
    initial: Ruleset? = null,
) : RulesetRepository {
    private data class Row(
        val id: Int,
        val stored: StoredRuleset,
        val from: Long,
        var superseded: Boolean = false,
    )

    private val rows = mutableListOf<Row>()

    /** How many changes were committed (the seed does not count). */
    var commits: Int = 0
        private set

    init {
        if (initial != null) insert(initial, from = 0, source = RulesetSource.PRESET, now = 0)
    }

    override suspend fun active(now: String): StoredRuleset? =
        synchronized(rows) {
            val at = epochSecondsOf(now)
            live().filter { it.from <= at }.maxWithOrNull(compareBy<Row> { it.from }.thenBy { it.id })?.stored
        }

    override suspend fun pending(now: String): StoredRuleset? =
        synchronized(rows) {
            val at = epochSecondsOf(now)
            live().filter { it.from > at }.maxWithOrNull(compareBy<Row> { it.from }.thenBy { it.id })?.stored
        }

    override suspend fun commit(
        change: RulesetChange,
        now: String,
    ): String =
        synchronized(rows) {
            commitLocked(change, epochSecondsOf(now))
        }

    private fun commitLocked(
        change: RulesetChange,
        at: Long,
    ): String {
        val requested = change.effectiveFrom?.let(::epochSecondsOf) ?: at
        val pendingFrom = live().filter { it.from > at }.maxOfOrNull { it.from }
        val nextFrom = if (requested > at && pendingFrom != null) maxOf(requested, pendingFrom) else requested
        live().filter { it.from > at }.forEach { it.superseded = true }
        if (change.effectiveFrom != null) insert(change.effectiveToday, at, change.source, at)
        insert(change.next, nextFrom, change.source, at)
        commits += 1
        return utcInstantOf(nextFrom)
    }

    private fun live(): List<Row> = rows.filterNot { it.superseded }

    private fun insert(
        ruleset: Ruleset,
        from: Long,
        source: RulesetSource,
        now: Long,
    ) {
        rows += Row(rows.size + 1, StoredRuleset(ruleset, utcInstantOf(from), source, utcInstantOf(now)), from)
    }
}
