// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The surface a screen was classified into, the pack that recognised it and
 * the tier that decided it. [basis] is a reason code for diagnostics (a pack
 * that only matches through labels hints at renamed view ids); it never
 * carries node text.
 */
data class SurfaceMatch(
    val surface: String,
    val packId: String,
    val basis: MatchBasis,
)

/** Which detector tier recognised the surface (plan §2.3). */
enum class MatchBasis {
    /** Every deciding predicate named a view id. */
    VIEW_ID,

    /** At least one deciding predicate compared a content description or text. */
    LABEL,
}
