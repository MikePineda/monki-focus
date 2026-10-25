// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/**
 * `activity.schema.json#/$defs/activity`: what categorisation sees
 * (SEMANTICS.md §9). `activityKey` is the normalised domain (web) or the
 * package / bundle id (app, android); `path` is null when unknown.
 */
data class CategorisableActivity(
    val source: ActivitySource,
    val activityKey: String,
    val path: String?,
    val surface: String?,
)
