// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.ports.StoredRuleset
import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * One revision of the rule-set document, append-only. `effectiveToday` and
 * `next` of one change share the document's `revision`, so rows are keyed by
 * their own id. A pending row replaced by a later change is kept with
 * `superseded_at` set and never becomes active.
 */
@Entity(
    tableName = MonkiTables.RULESET_REVISION,
    indices = [Index(value = ["effective_from"])],
)
data class RulesetRevisionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val revision: Int,
    @ColumnInfo(name = "schema_version") val schemaVersion: Int,
    val json: String,
    val source: RulesetSource,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "effective_from") val effectiveFrom: Long,
    @ColumnInfo(name = "superseded_at") val supersededAt: Long? = null,
) {
    fun toDomain(): StoredRuleset =
        StoredRuleset(
            ruleset = RulesJson.decodeFromString(Ruleset.serializer(), json),
            effectiveFrom = instantOfMillis(effectiveFrom),
            source = source,
            createdAt = instantOfMillis(createdAt),
        )

    companion object {
        fun of(
            ruleset: Ruleset,
            source: RulesetSource,
            createdAt: Long,
            effectiveFrom: Long,
        ): RulesetRevisionEntity =
            RulesetRevisionEntity(
                revision = ruleset.revision,
                schemaVersion = ruleset.schemaVersion,
                json = RulesJson.encodeToString(Ruleset.serializer(), ruleset),
                source = source,
                createdAt = createdAt,
                effectiveFrom = effectiveFrom,
            )
    }
}
