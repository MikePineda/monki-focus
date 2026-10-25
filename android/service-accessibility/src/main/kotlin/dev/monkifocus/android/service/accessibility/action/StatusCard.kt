// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/** The protection status cards of [OverlayContent.Card]. */
enum class StatusCard {
    /** "Finish setting up monki-focus": opens our app; nothing is enforced meanwhile. */
    SETUP,

    /** Protection is on but notifications are off: what that means, and a button to allow them. */
    NOTICE_OFF,
}
