// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/*
 * The focus pulse (SEMANTICS.md §10.5): `round(Σ(seconds × level) / Σ seconds)`
 * rounded half up, identical to RescueTime's `Σ(s × k) / (Σ s × 4) × 100`
 * with `k = level / 25`. Null without tracked time. Integer arithmetic only,
 * so every platform rounds identically.
 */

/** Seconds spent at one productivity level. */
data class PulseInput(
    val seconds: Long,
    val level: Int,
)

fun pulse(entries: List<PulseInput>): Int? {
    var total = 0L
    var weighted = 0L
    for (entry in entries) {
        total += entry.seconds
        weighted += entry.seconds * entry.level
    }
    if (total == 0L) return null
    // Half up: floor(weighted / total + 1/2) without floating point.
    return Math.floorDiv(weighted * 2 + total, total * 2).toInt()
}
