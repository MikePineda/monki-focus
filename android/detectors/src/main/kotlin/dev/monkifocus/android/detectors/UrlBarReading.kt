// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/** What the URL bar of the foreground browser holds. */
sealed interface UrlBarReading {
    /** The raw URL bar text, possibly only a domain (`reddit.com`), for `normalizeUrl`. */
    data class Shown(
        val urlText: String,
    ) : UrlBarReading {
        // Never print the URL by accident (debug strings, crash reports).
        override fun toString(): String = "Shown(⟨url⟩)"
    }

    /** The bar has focus: the user is typing, nothing is read. */
    data object BeingEdited : UrlBarReading

    /** No URL bar of this pack is on screen. */
    data object Absent : UrlBarReading
}
