// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** `activity.schema.json#/$defs/segment`: who a stretch `[start, end)` of time belongs to (§10.8). */
data class AttributedSegment(
    val start: String,
    val end: String,
    val source: ActivitySource,
    val activityKey: String,
)
