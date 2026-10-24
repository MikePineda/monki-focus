// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/** The outcome of loading one detector pack. */
sealed interface PackLoadResult {
    data class Accepted(
        val pack: DetectorPack,
    ) : PackLoadResult

    data class Rejected(
        val reason: PackRejection,
    ) : PackLoadResult
}
