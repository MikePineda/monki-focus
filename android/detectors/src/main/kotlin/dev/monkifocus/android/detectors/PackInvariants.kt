// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Compiled invariants every pack must satisfy, signed or bundled (defence in
 * depth: a valid signature proves who made a pack, not that it is sane).
 * A violation rejects the pack and the bundled one stays active.
 *
 * - a URL bar pack (`browsers`) declares URL bar ids and no surfaces; every
 *   other pack declares surfaces and no URL bar ids;
 * - every surface belongs to the pack's compiled family (`instagram.*` for
 *   `instagram`, `guard.*` for `settings`) and, outside `guard.*`, exists in
 *   `data/surfaces.json`;
 * - the settings pack covers all four [GuardedScreen]s;
 * - Instagram and YouTube keep the unclassified safety net at
 *   [MIN_UNCLASSIFIED_CAP_MINUTES] or more;
 * - an allow-only surface is only recognised with its compiled evidence
 *   ([AllowOnlySurfaces]);
 * - a text or content-description predicate always names a view id too, so
 *   no detector is a bare "this text is on screen" probe.
 */
class PackInvariants(
    private val registeredSurfaces: Set<String>,
) {
    fun holds(pack: DetectorPack): Boolean {
        val family = FAMILIES[pack.packId] ?: return false
        if (pack.packId in URL_BAR_PACKS) return pack.surfaces.isEmpty() && pack.urlBarViewIds.isNotEmpty()
        if (pack.surfaces.isEmpty() || pack.urlBarViewIds.isNotEmpty()) return false
        if (!pack.surfaces.all { isOwnSurface(it.surface, family) }) return false
        if (pack.packId == SETTINGS_PACK &&
            pack.surfaces.map { it.surface }.toSet() != GuardedScreen.entries.map { it.surfaceId }.toSet()
        ) {
            return false
        }
        if (pack.packId in CAPPED_PACKS && pack.unclassifiedCapMinutes < MIN_UNCLASSIFIED_CAP_MINUTES) return false
        return pack.surfaces.all { detector -> hasEvidence(detector) && detector.predicates().all(::isScopedToAViewId) }
    }

    private fun isOwnSurface(
        surface: String,
        family: String,
    ): Boolean = surface.substringBefore('.') == family && (family == GUARD_FAMILY || surface in registeredSurfaces)

    private fun hasEvidence(detector: SurfaceDetector): Boolean {
        if (!AllowOnlySurfaces.isAllowOnly(detector.surface)) return true
        val evidence = AllowOnlySurfaces.EVIDENCE[detector.surface] ?: return false
        val all =
            detector.all
                .orEmpty()
                .mapNotNull { it.viewId?.let(::shortId) }
                .toSet()
        val any =
            detector.any
                .orEmpty()
                .mapNotNull { it.viewId?.let(::shortId) }
                .toSet()
        val none =
            detector.none
                .orEmpty()
                .mapNotNull { it.viewId?.let(::shortId) }
                .toSet()
        return evidence.oneOfInAll.any { it in all } &&
            (evidence.oneOfInAllOrAny.isEmpty() || evidence.oneOfInAllOrAny.any { it in all || it in any }) &&
            none.containsAll(evidence.vetoes)
    }

    private fun isScopedToAViewId(predicate: NodePredicate): Boolean = !predicate.readsLabel || predicate.viewId != null

    private fun SurfaceDetector.predicates(): List<NodePredicate> = all.orEmpty() + any.orEmpty() + none.orEmpty()

    private fun shortId(viewId: String): String = viewId.substringAfter(":id/")

    companion object {
        /** Pack id → the surface family it may emit. */
        val FAMILIES: Map<String, String> =
            mapOf("instagram" to "instagram", "youtube" to "youtube", "browsers" to "browsers", "settings" to "guard")

        const val MIN_UNCLASSIFIED_CAP_MINUTES = 5

        private const val SETTINGS_PACK = "settings"
        private const val GUARD_FAMILY = "guard"
        private val URL_BAR_PACKS = setOf("browsers")
        private val CAPPED_PACKS = setOf("instagram", "youtube")
    }
}
