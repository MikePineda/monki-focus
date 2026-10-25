// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import dev.monkifocus.android.detectors.Rect

/**
 * The band of the screen a hide-feed cover hides, in pixels from the top
 * (plan §2.3 `CoverRegion`): everything between the bars the pack keeps
 * visible (`keepVisible`: the URL bar, Instagram's action and tab bars,
 * YouTube's pivot bar), so the user can still type a URL or switch tabs.
 * Bars whose centre is in the top half bound it from above, the others from
 * below; without bars it is the whole screen.
 */
data class CoverRegion(
    val top: Int,
    val bottom: Int,
) {
    companion object {
        fun between(
            keepVisible: List<Rect>,
            screenHeight: Int,
        ): CoverRegion {
            val middle = screenHeight / 2
            val (upper, lower) = keepVisible.partition { (it.top + it.bottom) / 2 < middle }
            val top = upper.maxOfOrNull { it.bottom }?.coerceIn(0, screenHeight) ?: 0
            val bottom = lower.minOfOrNull { it.top }?.coerceIn(0, screenHeight) ?: screenHeight
            return if (top < bottom) CoverRegion(top, bottom) else CoverRegion(0, screenHeight)
        }
    }
}
