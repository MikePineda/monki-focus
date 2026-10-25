// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.detectors.BrowserUrlExtractor
import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.DmReelSession
import dev.monkifocus.android.detectors.PredicateEvaluator
import dev.monkifocus.android.detectors.Rect
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.detectors.ScreenIndex
import dev.monkifocus.android.detectors.SurfaceClassifier
import dev.monkifocus.android.detectors.UrlBarReading
import dev.monkifocus.android.service.accessibility.action.CoverRegion
import dev.monkifocus.android.service.accessibility.guard.AntiBypassGuard

/**
 * Turns one screen read into a [ScreenObservation] with the active detector
 * packs:
 *
 * - Settings and the package installer (the `settings` pack) go to the
 *   [AntiBypassGuard] and nothing else: their node text is compared with our
 *   own labels in memory, never read for a decision;
 * - a browser pack (one with `urlBarViewIds`) reads the URL bar through
 *   [BrowserUrlExtractor], and the text is cut to a [UrlKey] right away;
 * - every other pack classifies the screen with [SurfaceClassifier], and a
 *   `reel_from_dm` match goes through [DmReelSession] so it needs the inbox
 *   first.
 *
 * Stateful only through the DM reel session; time is a monotonic reading.
 */
class ScreenObserver(
    private val catalog: RulesCatalog,
    private val guard: AntiBypassGuard,
    private val classifier: SurfaceClassifier = SurfaceClassifier(),
    private val urlExtractor: BrowserUrlExtractor = BrowserUrlExtractor(),
) {
    private var dmReels = DmReelSession.INITIAL

    fun observe(
        screen: Screen,
        packs: List<DetectorPack>,
        nowMonotonicMs: Long,
    ): ScreenObservation {
        val pkg = screen.packageName
        val applicable = packs.filter { it.appliesTo(pkg) }
        applicable.firstOrNull { it.packId == SETTINGS_PACK_ID }?.let { settings ->
            val guarded = guard.inspect(screen, settings)
            return if (guarded != null) ScreenObservation.Guarded(pkg, guarded) else ScreenObservation.Unguarded(pkg)
        }
        applicable.firstOrNull { it.urlBarViewIds.isNotEmpty() }?.let { browser ->
            return when (val reading = urlExtractor.read(screen, browser)) {
                is UrlBarReading.Shown -> {
                    ScreenObservation.Site(
                        pkg,
                        UrlKey.of(reading.urlText, catalog),
                        coverOf(screen, browser),
                        reading.urlText,
                    )
                }

                UrlBarReading.BeingEdited -> {
                    ScreenObservation.UrlBeingEdited(pkg)
                }

                UrlBarReading.Absent -> {
                    ScreenObservation.UrlAbsent(pkg)
                }
            }
        }
        if (applicable.isEmpty()) return ScreenObservation.Untracked(pkg)
        val step = dmReels.observe(classifier.classify(screen, applicable), nowMonotonicMs)
        dmReels = step.session
        val pack = applicable.firstOrNull { it.packId == step.match?.packId } ?: applicable.first()
        return ScreenObservation.App(pkg, step.match?.surface, coverOf(screen, pack))
    }

    private fun coverOf(
        screen: Screen,
        pack: DetectorPack,
    ): CoverRegion = CoverRegion.between(keepVisible(screen, pack), screen.height)

    /** Bounds of the pack's `keepVisible` bars the app itself draws on screen (a page cannot fake them). */
    private fun keepVisible(
        screen: Screen,
        pack: DetectorPack,
    ): List<Rect> {
        if (pack.keepVisible.isEmpty()) return emptyList()
        val index = ScreenIndex.of(screen)
        return pack.keepVisible
            .flatMap { PredicateEvaluator.qualifiedIds(it, screen.packageName) }
            .flatMap(index::withViewId)
            .filter { it.isVisibleToUser && screen.shows(it.bounds) }
            .map { it.bounds }
    }

    companion object {
        /** The pack of the system screens the anti-bypass guard protects. */
        const val SETTINGS_PACK_ID = "settings"
    }
}
