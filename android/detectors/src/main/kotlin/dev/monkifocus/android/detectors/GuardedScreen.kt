// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * A system screen that could undo the user's own commitment for this app
 * (plan §2.8). The anti-bypass guard bounces from these, and only from these:
 * the same screens for any other app stay untouched.
 */
enum class GuardedScreen(
    /** The `guard.*` surface id of `settings.pack.json`. */
    val surfaceId: String,
) {
    DEVICE_ADMIN("guard.device_admin"),
    ACCESSIBILITY_DETAIL("guard.accessibility_detail"),
    APP_INFO("guard.app_info"),
    UNINSTALL("guard.uninstall"),
    ;

    companion object {
        fun ofSurface(surfaceId: String): GuardedScreen? = entries.firstOrNull { it.surfaceId == surfaceId }
    }
}
