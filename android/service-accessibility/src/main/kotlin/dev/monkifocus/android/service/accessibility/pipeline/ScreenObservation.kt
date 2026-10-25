// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.service.accessibility.action.CoverRegion

/**
 * What one screen read found. No node text survives in here except the URL
 * bar text of [Site], which lives only for the event that read it.
 */
sealed interface ScreenObservation {
    val packageName: String

    /**
     * An app screen of a detector pack: [surface] after the DM-reel check,
     * null when nothing matched (the unclassified safety net counts it).
     * [cover] is the band a feed cover hides, between the pack's bars.
     */
    data class App(
        override val packageName: String,
        val surface: String?,
        val cover: CoverRegion,
    ) : ScreenObservation

    /**
     * A browser page. [urlText] is the raw URL bar text for this event's
     * `decide` call only; [key] is all that is kept. Not a data class, so it
     * is never compared, hashed or printed with the URL in it.
     */
    class Site(
        override val packageName: String,
        val key: UrlKey,
        val cover: CoverRegion,
        val urlText: String,
    ) : ScreenObservation {
        val observationKey: ObservationKey get() = ObservationKey.Site(packageName, key)

        override fun toString(): String = "Site($packageName, ⟨url⟩)"
    }

    /** The URL bar has focus: the user is typing, nothing is read or decided. */
    data class UrlBeingEdited(
        override val packageName: String,
    ) : ScreenObservation

    /** No URL bar on screen (toolbar scrolled away, full-screen video): keep what is shown. */
    data class UrlAbsent(
        override val packageName: String,
    ) : ScreenObservation

    /** One of our own system screens the anti-bypass guard protects. */
    data class Guarded(
        override val packageName: String,
        val screen: GuardedScreen,
    ) : ScreenObservation

    /** Settings or the package installer, on any screen that is not ours. */
    data class Unguarded(
        override val packageName: String,
    ) : ScreenObservation

    /** A package no loaded pack covers. */
    data class Untracked(
        override val packageName: String,
    ) : ScreenObservation
}
