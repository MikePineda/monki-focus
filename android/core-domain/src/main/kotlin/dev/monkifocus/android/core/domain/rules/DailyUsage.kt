// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.rules

import kotlinx.serialization.Serializable

/**
 * `decision-context.schema.json#/$defs/dailyUsage`: active seconds spent today
 * per budgeted rule, ignored unless `localDate` is today in a pinned zone.
 */
@Serializable
data class DailyUsage(
    val localDate: String,
    val secondsByRule: Map<String, Int>,
)
