// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/** What a decision asks of the device, before the gate state is worked out. */
sealed interface ActionPlan {
    /** Access allowed and the content shown: remove our overlay. */
    data object Clear : ActionPlan

    /** A blocked surface (Reels, Shorts): BACK toward the inbox or home, then a dismissible notice. */
    data object BackWithNotice : ActionPlan

    /** A gate, block or bedtime screen of `:feature-gate`. */
    data object Gate : ActionPlan

    /** Access allowed but the feed hidden: cover [region]. */
    data class Cover(
        val region: CoverRegion,
    ) : ActionPlan
}
