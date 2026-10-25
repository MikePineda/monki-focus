// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.packs

/** What one re-verification of the stored detector packs found: counts only. */
data class PackRecheckResult(
    val accepted: Int,
    val rejected: Int,
)
