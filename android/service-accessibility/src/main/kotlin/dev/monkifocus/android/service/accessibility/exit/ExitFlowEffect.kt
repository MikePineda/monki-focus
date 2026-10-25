// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** What the end of the exit flow makes the adapter do, in this order. */
enum class ExitFlowEffect {
    /** Queue the neutral `protection_ended` event for the guardian. */
    RECORD_PROTECTION_ENDED,

    /** `DevicePolicyManager.removeActiveAdmin` on our own receiver. */
    DISARM_DEVICE_ADMIN,

    /** Remove overlays and the notice, stop enforcing and turn the service off (`disableSelf`). */
    STOP_PROTECTION,
}
