// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Reads the URL a supported browser shows (plan §2.3). It looks up the
 * pack's `urlBarViewIds` in fallback order (short ids prefixed with the
 * browser's package, through the native `findByViewId` fast path) and
 * returns the raw text of the first visible URL bar, untouched, for the
 * engine's `normalizeUrl`.
 *
 * Privacy: this is the only place that reads node text for its value, and it
 * reads the URL bar node and nothing else. A focused bar means the user is
 * typing, so its text is not read at all. The text is never stored or
 * logged here.
 */
object BrowserUrlExtractor {
    fun read(
        screen: Screen,
        pack: DetectorPack,
    ): UrlBarReading {
        if (!pack.appliesTo(screen.packageName)) return UrlBarReading.Absent
        for (viewId in pack.urlBarViewIds) {
            val bars =
                PredicateEvaluator
                    .qualifiedIds(viewId, screen.packageName)
                    .flatMap { screen.root.findByViewId(it) }
                    .filter { it.isVisibleToUser && screen.shows(it.bounds) }
            if (bars.isEmpty()) continue
            if (bars.any(UiNode::isFocused)) return UrlBarReading.BeingEdited
            val text = bars.firstNotNullOfOrNull { bar -> bar.text?.takeIf(String::isNotBlank) } ?: continue
            return UrlBarReading.Shown(text)
        }
        return UrlBarReading.Absent
    }
}
