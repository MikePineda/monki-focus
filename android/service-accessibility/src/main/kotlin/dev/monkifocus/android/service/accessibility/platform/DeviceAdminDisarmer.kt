// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import dev.monkifocus.android.service.accessibility.exit.ProtectionDisarmer
import dev.monkifocus.android.service.accessibility.notice.NoticeContent
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier

/**
 * Ends protection when the accessibility service is not running (the exit
 * flow finished from the app screen): removes our device admin, which an
 * app may always do for itself, and takes the notice down. With the service
 * running, the service's own disarmer also clears its overlays and turns
 * itself off.
 */
class DeviceAdminDisarmer(
    context: Context,
    private val admin: ComponentName,
    private val notifier: ProtectionNotifier,
) : ProtectionDisarmer {
    private val policies: DevicePolicyManager? = context.getSystemService(DevicePolicyManager::class.java)

    override fun disarmDeviceAdmin() {
        val manager = policies ?: return
        if (manager.isAdminActive(admin)) manager.removeActiveAdmin(admin)
    }

    override fun stopProtection() {
        notifier.reconcile(protectionActive = false, content = NoticeContent(guardianLinked = false, exitPending = false))
    }
}
