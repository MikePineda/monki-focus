// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/**
 * `activity.schema.json#/$defs/dailyTotal`: one local date's total seconds,
 * its seconds by level (every level 0, 25, 50, 75, 100 present, in that
 * order) and its pulse (null without tracked time).
 */
data class DailyTotal(
    val date: String,
    val seconds: Long,
    val secondsByLevel: Map<Int, Long>,
    val pulse: Int?,
)
