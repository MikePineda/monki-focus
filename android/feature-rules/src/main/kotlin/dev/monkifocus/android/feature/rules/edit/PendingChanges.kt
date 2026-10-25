// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.edit

import dev.monkifocus.android.core.domain.rules.Ruleset

/** What still waits: the twin of the extension's `pendingChanges`. */
object PendingChanges {
    /**
     * Every part where the [configured] (pending) set differs from the
     * [effective] one. Revision, `updatedAt` and `pendingTimeZone` are
     * bookkeeping, not changes (a waiting second zone is a time-zone change).
     */
    fun between(
        effective: Ruleset,
        configured: Ruleset,
    ): List<PendingChange> {
        val changes = mutableListOf<PendingChange>()
        val before = effective.rules.associateBy { it.id }
        val after = configured.rules.associateBy { it.id }
        for ((id, rule) in after) {
            val previous = before[id]
            when {
                previous == null -> changes += PendingChange.RuleAdded(id, rule.target)
                previous != rule -> changes += PendingChange.RuleChanged(id, rule.target)
            }
        }
        for ((id, rule) in before) if (id !in after) changes += PendingChange.RuleRemoved(id, rule.target)
        if (effective.bedtime != configured.bedtime) changes += PendingChange.BedtimeChanged
        if (effective.workHours != configured.workHours) changes += PendingChange.WorkHoursChanged
        // Category assignments compare as a set: the engine may reorder them.
        if (effective.categories.toSet() != configured.categories.toSet()) changes += PendingChange.CategoriesChanged
        if (effective.timeZone != configured.timeZone || effective.pendingTimeZone != null) changes += PendingChange.TimeZoneChanged
        return changes
    }

    /** Rule ids whose configured version does not apply yet (added, changed or removed). */
    fun ruleIds(changes: List<PendingChange>): Set<String> =
        changes
            .mapNotNull {
                when (it) {
                    is PendingChange.RuleAdded -> it.ruleId
                    is PendingChange.RuleChanged -> it.ruleId
                    is PendingChange.RuleRemoved -> it.ruleId
                    else -> null
                }
            }.toSet()
}
