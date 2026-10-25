// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.guard

/**
 * Whether another package carries one of our labels (plan 04 §2): a
 * look-alike app must never be trapped behind our guard, so any other
 * installed package, installed accessibility service or active device admin
 * named like us releases every guard. An active admin whose label could
 * not be read counts as a collision too (fail toward letting the user out).
 * Labels are compared trimmed, in memory only.
 */
object LabelCollision {
    /** An installed package or an active admin and its label (null when it could not be read). */
    data class Labelled(
        val packageName: String,
        val label: String?,
    )

    fun exists(
        ownLabels: Set<String>,
        ourPackage: String,
        installed: List<Labelled>,
        activeAdmins: List<Labelled>,
        accessibilityServices: List<Labelled> = emptyList(),
    ): Boolean {
        val labels = ownLabels.map(String::trim).filter(String::isNotEmpty).toSet()
        val namedLikeUs = { entry: Labelled -> entry.packageName != ourPackage && entry.label?.trim()?.let { it in labels } == true }
        return installed.any(namedLikeUs) ||
            accessibilityServices.any(namedLikeUs) ||
            activeAdmins.any { it.packageName != ourPackage && (it.label == null || namedLikeUs(it)) }
    }
}
