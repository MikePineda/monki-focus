// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * The packages each pack id may target, compiled into the app
 * (docs/threat-model.md, "Reglas"): a downloaded pack can refine how a known
 * app is classified, never reach a package or pack id this list does not
 * name. Widening it takes an app release.
 */
class PackageAllowlist(
    private val packagesByPackId: Map<String, Set<String>>,
) {
    /** True when [packId] is known and every one of [packages] is allowed for it. */
    fun permits(
        packId: String,
        packages: Collection<String>,
    ): Boolean {
        val allowed = packagesByPackId[packId] ?: return false
        return packages.all { it in allowed }
    }

    companion object {
        /** The allowlist this build ships with. */
        val COMPILED =
            PackageAllowlist(
                mapOf(
                    "instagram" to setOf("com.instagram.android"),
                    "youtube" to setOf("com.google.android.youtube"),
                    "browsers" to
                        setOf(
                            "com.android.chrome",
                            "com.brave.browser",
                            "com.vivaldi.browser",
                            "org.cromite.cromite",
                            "app.vanadium.browser",
                            "org.mozilla.firefox",
                            "com.sec.android.app.sbrowser",
                        ),
                    "settings" to
                        setOf(
                            "com.android.settings",
                            "com.google.android.packageinstaller",
                            "com.android.packageinstaller",
                        ),
                ),
            )
    }
}
