// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.bypass

/** The bypass events this service records, with their codes (`BypassEvent.kind`). */
enum class BypassKind(
    val code: String,
) {
    /** The emergency wait ended and access was granted (SEMANTICS.md §7.3 `record_bypass`). */
    EMERGENCY_OVERRIDE("emergency_override"),

    /** The system unbound or interrupted the service while protection was on. */
    ACCESSIBILITY_DISABLED("accessibility_disabled"),

    /** Device admin was turned off outside the exit flow. */
    DEVICE_ADMIN_DISABLED("device_admin_disabled"),

    /** "Exit and unlink" finished: a neutral notice, never a warning. */
    PROTECTION_ENDED("protection_ended"),
}
