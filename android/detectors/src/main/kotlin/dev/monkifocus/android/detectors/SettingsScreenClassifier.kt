// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Recognises the system screens of OUR app that the anti-bypass guard
 * protects (plan §2.8): device-admin deactivation, our accessibility service
 * detail, our App info and our uninstall dialog.
 *
 * Two conditions, both required:
 * 1. the screen has the shape of a guarded screen: a `guard.*` surface of
 *    the settings pack (Settings and package-installer view ids, as data);
 * 2. one of [ownLabels] is on screen, as the exact text or content
 *    description of a visible node. The labels are our app and service
 *    names in the device language, read from our own resources by the
 *    caller; we control them, so they are stable where Settings strings are
 *    not.
 *
 * The same screens for any other app are never guarded, so Settings keeps
 * working. Node text is compared in memory only.
 */
class SettingsScreenClassifier(
    private val settingsPack: DetectorPack,
    ownLabels: Set<String>,
    private val classifier: SurfaceClassifier = SurfaceClassifier(),
    private val traversal: BoundedTraversal = BoundedTraversal(),
) {
    private val ownLabels: Set<String> = ownLabels.map(String::trim).filter(String::isNotEmpty).toSet()

    init {
        require(this.ownLabels.isNotEmpty()) { "at least one own label is required" }
    }

    fun classify(screen: Screen): GuardedScreen? {
        val match = classifier.classify(screen, listOf(settingsPack)) ?: return null
        val guarded = GuardedScreen.ofSurface(match.surface) ?: return null
        return guarded.takeIf { showsOwnLabel(screen) }
    }

    private fun showsOwnLabel(screen: Screen): Boolean =
        traversal.walk(screen.root).nodes.any { node ->
            node.isVisibleToUser &&
                screen.shows(node.bounds) &&
                (node.text?.trim() in ownLabels || node.contentDescription?.trim() in ownLabels)
        }
}
