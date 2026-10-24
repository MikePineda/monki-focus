// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.usage

/**
 * The system usage events the analytics pipeline reads (plan §2.10): an app
 * coming to or leaving the foreground, the screen turning on or off, the
 * keyguard showing or hiding and the device shutting down. Nothing else is
 * read from the system.
 */
enum class UsageEventKind {
    ACTIVITY_RESUMED,
    ACTIVITY_PAUSED,
    SCREEN_INTERACTIVE,
    SCREEN_NON_INTERACTIVE,
    KEYGUARD_SHOWN,
    KEYGUARD_HIDDEN,
    DEVICE_SHUTDOWN,
    ;

    /** Whether the event belongs to one app (and so carries its package name). */
    val isActivity: Boolean
        get() = this == ACTIVITY_RESUMED || this == ACTIVITY_PAUSED
}
