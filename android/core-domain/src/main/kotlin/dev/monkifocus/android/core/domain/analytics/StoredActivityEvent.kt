// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** An [ActivityEvent] as the store keeps it: with the id it assigned and its bucket. */
data class StoredActivityEvent(
    val id: Long,
    val bucketId: String,
    val event: ActivityEvent,
)
