// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import dev.monkifocus.android.service.accessibility.bypass.BypassKind
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Device admin as uninstall friction only (plan §2.8): `res/xml/device_admin.xml`
 * declares no policies, so it can do nothing to the device; while active,
 * Android asks to deactivate it before uninstalling. Exported only to holders
 * of `BIND_DEVICE_ADMIN` (the system).
 *
 * Turning it off in Settings is recorded as a bypass, unless "Exit and
 * unlink" ended protection first: that exit removes the admin itself and
 * is never a bypass.
 */
class MonkiDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onDisableRequested(
        context: Context,
        intent: Intent,
    ): CharSequence = context.getString(CoreUiR.string.device_admin_disable_warning)

    override fun onDisabled(
        context: Context,
        intent: Intent,
    ) {
        val protection = (context.applicationContext as MonkiApplication).graph.protection
        if (protection.exitFlow.protectionEnded) return
        protection.bypasses.record(BypassKind.DEVICE_ADMIN_DISABLED, System.currentTimeMillis())
    }
}
