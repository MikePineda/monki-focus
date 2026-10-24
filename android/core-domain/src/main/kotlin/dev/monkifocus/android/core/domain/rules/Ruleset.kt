// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `ruleset.schema.json`: the document that is imported, exported, synced and
 * enforced. `timeZone` is the only zone (§6.3); `pendingTimeZone` is set only
 * while a zone change waits.
 */
@Serializable
data class Ruleset(
    val schemaVersion: Int,
    val revision: Int,
    val updatedAt: String,
    val timeZone: String,
    val pendingTimeZone: String? = null,
    val rules: List<Rule>,
    val categories: List<CategoryAssignment>,
    val bedtime: Bedtime,
    val workHours: Schedule,
)
