// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

/**
 * The heatmap colour of a pulse: the five level bands 0–19, 20–39, 40–59,
 * 60–79 and 80–100 (DESIGN.md "Charts", like the extension); no time, no band.
 */
object PulseBand {
    const val COUNT = 5

    fun of(pulse: Int?): Int? = pulse?.let { (it / BAND_WIDTH).coerceIn(0, COUNT - 1) }

    /** The pulse range `[from, to]` of [band] (the last band ends at 100). */
    fun rangeOf(band: Int): IntRange = (band * BAND_WIDTH)..(if (band == COUNT - 1) MAX_PULSE else band * BAND_WIDTH + BAND_WIDTH - 1)

    private const val BAND_WIDTH = 20
    private const val MAX_PULSE = 100
}
