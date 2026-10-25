// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

/** Port: the device side of ending protection. Each call must not throw; failures are ignored. */
interface ProtectionDisarmer {
    /** Removes our own device admin, if active. */
    fun disarmDeviceAdmin()

    /** Clears overlays and the persistent notice and turns the accessibility service off. */
    fun stopProtection()
}
