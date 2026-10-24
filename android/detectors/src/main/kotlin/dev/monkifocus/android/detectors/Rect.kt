// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/** Screen bounds in pixels; a domain type, not `android.graphics.Rect`. */
data class Rect(
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
) {
    val width: Int get() = right - left
    val height: Int get() = bottom - top
}
