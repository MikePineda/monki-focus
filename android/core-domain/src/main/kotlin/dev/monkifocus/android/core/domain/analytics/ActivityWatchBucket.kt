// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/** A local bucket and its events, ready to export to ActivityWatch or read back from an export. */
data class ActivityWatchBucket(
    val bucket: ActivityBucket,
    val events: List<ActivityEvent>,
)
