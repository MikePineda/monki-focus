// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

/** What one [UsageIngest] run did: counts only, never a package name or a domain. */
data class UsageIngestResult(
    val accessGranted: Boolean,
    val newEvents: Int,
    val changedBlocks: Int,
    val purgedEvents: Int,
)
