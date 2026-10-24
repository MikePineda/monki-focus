// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * Recognises the system screens of OUR app that the anti-bypass guard
 * protects (plan §2.8): device-admin deactivation, our accessibility service
 * detail, our App info and our uninstall dialog.
 *
 * Conditions, all required:
 * 1. the screen has the shape of a guarded screen: a `guard.*` surface of
 *    the settings pack (Settings and package-installer view ids, as data);
 * 2. one of [ownLabels] is on screen, as the exact text or content
 *    description of a visible node. The labels are our app and service
 *    names in the device language, read from our own resources by the
 *    caller; we control them, so they are stable where Settings strings are
 *    not;
 * 3. for the uninstall and device-admin screens, when the screen shows a
 *    package name at all, it is [ourPackage];
 * 4. for App info, uninstall and device admin, no label collision: the
 *    caller passes `labelCollision = true` when any other installed package
 *    or active device admin carries one of our labels (it computes this with
 *    `PackageManager` / `DevicePolicyManager`, which this pure module cannot
 *    reach). A look-alike app must never be trapped, so a collision means
 *    those screens are not guarded (fail toward letting the user out).
 *
 * The same screens for any other app are never guarded, so Settings keeps
 * working. Node text is compared in memory only.
 */
class SettingsScreenClassifier(
    private val settingsPack: DetectorPack,
    ownLabels: Set<String>,
    private val ourPackage: String,
    private val classifier: SurfaceClassifier = SurfaceClassifier(),
    private val traversal: BoundedTraversal = BoundedTraversal(),
) {
    private val ownLabels: Set<String> = ownLabels.map(String::trim).filter(String::isNotEmpty).toSet()

    init {
        require(this.ownLabels.isNotEmpty()) { "at least one own label is required" }
        require(PACKAGE_NAME.matches(ourPackage)) { "ourPackage must be a package name" }
    }

    /** The guarded screen on display, or null (`NONE`) when the guard must stay out of the way. */
    fun classify(
        screen: Screen,
        labelCollision: Boolean,
    ): GuardedScreen? {
        val match = classifier.classify(screen, listOf(settingsPack)) ?: return null
        val guarded = GuardedScreen.ofSurface(match.surface) ?: return null
        if (labelCollision && guarded in COLLISION_SENSITIVE) return null
        val index = ScreenIndex.of(screen, traversal)
        if (!showsOwnLabel(index)) return null
        if (guarded in PACKAGE_CHECKED && showsAnotherPackage(index)) return null
        return guarded
    }

    private fun visibleLabels(index: ScreenIndex): Sequence<String> =
        index.nodes
            .asSequence()
            .filter { it.isVisibleToUser && index.screen.shows(it.bounds) }
            .flatMap { sequenceOf(it.text, it.contentDescription) }
            .filterNotNull()
            .map(String::trim)

    private fun showsOwnLabel(index: ScreenIndex): Boolean = visibleLabels(index).any { it in ownLabels }

    private fun showsAnotherPackage(index: ScreenIndex): Boolean =
        visibleLabels(index).any { PACKAGE_NAME.matches(it) && it != ourPackage && it !in ownLabels }

    private companion object {
        val COLLISION_SENSITIVE = setOf(GuardedScreen.APP_INFO, GuardedScreen.UNINSTALL, GuardedScreen.DEVICE_ADMIN)
        val PACKAGE_CHECKED = setOf(GuardedScreen.UNINSTALL, GuardedScreen.DEVICE_ADMIN)

        /** `target.schema.json#/$defs/appPackage`. */
        val PACKAGE_NAME = Regex("""^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_][A-Za-z0-9_-]*)+$""")
    }
}
