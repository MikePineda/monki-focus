// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** `activity.schema.json#/$defs/categoryMatch`: the level and category an activity counts as. */
data class CategoryMatch(
    val level: Int,
    val categoryPath: String,
)
