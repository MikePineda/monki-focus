// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction

@Dao
abstract class RulesetRevisionDao {
    @Insert
    abstract suspend fun insert(row: RulesetRevisionEntity): Long

    /** The latest live revision at or before [now] (ties: the later row). */
    @Query(
        "SELECT * FROM ruleset_revision WHERE superseded_at IS NULL AND effective_from <= :now " +
            "ORDER BY effective_from DESC, id DESC LIMIT 1",
    )
    abstract suspend fun active(now: Long): RulesetRevisionEntity?

    /** The live revision waiting after [now]; [commit] keeps at most one. */
    @Query(
        "SELECT * FROM ruleset_revision WHERE superseded_at IS NULL AND effective_from > :now " +
            "ORDER BY effective_from DESC, id DESC LIMIT 1",
    )
    abstract suspend fun pending(now: Long): RulesetRevisionEntity?

    @Query("UPDATE ruleset_revision SET superseded_at = :at WHERE superseded_at IS NULL AND effective_from > :now")
    abstract suspend fun supersedePending(
        now: Long,
        at: Long,
    ): Int

    /** Every row, oldest first (history and tests). */
    @Query("SELECT * FROM ruleset_revision ORDER BY id")
    abstract suspend fun history(): List<RulesetRevisionEntity>

    /**
     * One change, atomically: the pending revision is superseded, [today]
     * (when given) applies from [now] and [next] from its `effective_from`,
     * which never moves earlier than the superseded pending one's (SEMANTICS.md
     * §8). Answers the stored `effective_from` of [next].
     */
    @Transaction
    open suspend fun commit(
        today: RulesetRevisionEntity?,
        next: RulesetRevisionEntity,
        now: Long,
    ): Long {
        val pendingFrom = pending(now)?.effectiveFrom
        val nextFrom =
            if (next.effectiveFrom > now && pendingFrom != null) maxOf(next.effectiveFrom, pendingFrom) else next.effectiveFrom
        supersedePending(now = now, at = now)
        if (today != null) insert(today)
        insert(next.copy(effectiveFrom = nextFrom))
        return nextFrom
    }
}
