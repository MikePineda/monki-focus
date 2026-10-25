// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** A half-open `[start, end)` stretch of epoch seconds (SEMANTICS.md §1). */
data class Interval(
    val start: Long,
    val end: Long,
)
