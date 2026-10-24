// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Classifies a screen into a surface with the detector packs that apply to
 * its package (SEMANTICS.md §11, plan §2.3).
 *
 * Detectors run by descending priority, ties by surface id; the first one
 * whose `all`, `any` and `none` lists hold wins. Packs put their view-id
 * detectors above the label (content description / text) fallbacks, with
 * per-language label lists, so ids decide whenever they still exist. When
 * nothing matches the result is null and [UnclassifiedTimeCap] is the safety
 * net.
 */
class SurfaceClassifier(
    private val traversal: BoundedTraversal = BoundedTraversal(),
) {
    fun classify(
        screen: Screen,
        packs: List<DetectorPack>,
    ): SurfaceMatch? {
        val applicable = packs.filter { it.appliesTo(screen.packageName) }
        if (applicable.isEmpty()) return null
        val index = ScreenIndex.of(screen, traversal)
        return applicable
            .flatMap { pack -> pack.orderedSurfaces.map { pack to it } }
            .sortedWith(compareByDescending<Pair<DetectorPack, SurfaceDetector>> { it.second.priority }.thenBy { it.second.surface })
            .firstNotNullOfOrNull { (pack, detector) -> evaluate(detector, index)?.let { SurfaceMatch(detector.surface, pack.packId, it) } }
    }

    /** The deciding tier when [detector] holds on [index], or null when it does not. */
    private fun evaluate(
        detector: SurfaceDetector,
        index: ScreenIndex,
    ): MatchBasis? {
        val all = detector.all.orEmpty()
        if (!all.all { PredicateEvaluator.matches(it, index) }) return null
        val decidingAny =
            detector.any?.let { any -> any.firstOrNull { PredicateEvaluator.matches(it, index) } ?: return null }
        if (detector.none.orEmpty().any { PredicateEvaluator.matches(it, index) }) return null
        val deciding = all + listOfNotNull(decidingAny)
        return if (deciding.any(NodePredicate::readsLabel)) MatchBasis.LABEL else MatchBasis.VIEW_ID
    }
}
