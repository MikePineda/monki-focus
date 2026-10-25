// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.guard

import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.detectors.SettingsScreenClassifier

/**
 * Decides whether a Settings or package-installer screen is one of ours to
 * guard (plan §2.8), through [SettingsScreenClassifier]. The label
 * collision ([LabelCollision]) is asked for lazily, only when a screen
 * would otherwise be guarded. Every guarded screen is released on a
 * collision, our accessibility-service details page too: a look-alike app
 * or service could otherwise be trapped behind our card.
 *
 * A guarded screen is never blocked silently: the pipeline shows the bounce
 * card with the way out (plan 04 §2, conciliation rule 5).
 */
class AntiBypassGuard(
    private val ownLabels: Set<String>,
    private val ourPackage: String,
    private val labelCollision: () -> Boolean,
) {
    private var classifierPack: DetectorPack? = null
    private var classifier: SettingsScreenClassifier? = null

    fun inspect(
        screen: Screen,
        settingsPack: DetectorPack,
    ): GuardedScreen? {
        val guarded = classifierFor(settingsPack).classify(screen, labelCollision = false) ?: return null
        if (guarded in COLLISION_SENSITIVE && labelCollision()) return null
        return guarded
    }

    private fun classifierFor(pack: DetectorPack): SettingsScreenClassifier {
        val cached = classifier
        if (cached != null && classifierPack === pack) return cached
        return SettingsScreenClassifier(pack, ownLabels, ourPackage).also {
            classifier = it
            classifierPack = pack
        }
    }

    private companion object {
        val COLLISION_SENSITIVE =
            setOf(GuardedScreen.APP_INFO, GuardedScreen.UNINSTALL, GuardedScreen.DEVICE_ADMIN, GuardedScreen.ACCESSIBILITY_DETAIL)
    }
}
