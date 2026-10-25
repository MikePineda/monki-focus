// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/** Privacy invariants of the shipped manifest (docs/threat-model.md). */
@RunWith(RobolectricTestRunner::class)
class AppManifestTest {
    private val application = ApplicationProvider.getApplicationContext<MonkiApplication>()

    @Test
    fun merged_manifest_requests_no_internet_permission() {
        @Suppress("DEPRECATION")
        val requested =
            application.packageManager
                .getPackageInfo(application.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                .orEmpty()
                .toList()

        assertFalse("local-first: no INTERNET until the user configures a server", "android.permission.INTERNET" in requested)
    }

    @Test
    fun app_data_is_never_backed_up() {
        assertEquals(0, application.applicationInfo.flags and ApplicationInfo.FLAG_ALLOW_BACKUP)
    }

    @Test
    fun the_protection_notice_can_be_posted() {
        @Suppress("DEPRECATION")
        val requested =
            application.packageManager
                .getPackageInfo(application.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                .orEmpty()
                .toList()

        assertTrue("android.permission.POST_NOTIFICATIONS" in requested)
    }

    @Test
    fun only_the_launcher_and_the_system_guarded_device_admin_are_exported() {
        val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
        val manifest =
            DocumentBuilderFactory
                .newInstance()
                .apply { isNamespaceAware = true }
                .newDocumentBuilder()
                .parse(File(moduleDir, "src/main/AndroidManifest.xml"))

        val exported =
            listOf("activity", "activity-alias", "service", "receiver", "provider")
                .flatMap { tag ->
                    val nodes = manifest.getElementsByTagName(tag)
                    (0 until nodes.length).map { nodes.item(it) as Element }
                }.filter { it.getAttributeNS(ANDROID_NS, "exported") == "true" }
                .associate { it.getAttributeNS(ANDROID_NS, "name") to it.getAttributeNS(ANDROID_NS, "permission") }

        assertEquals(
            mapOf(".MainActivity" to "", ".MonkiDeviceAdminReceiver" to "android.permission.BIND_DEVICE_ADMIN"),
            exported,
        )
    }

    @Test
    fun the_launcher_icon_is_always_there() {
        val launcher =
            application.packageManager.queryIntentActivities(
                Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(application.packageName),
                0,
            )

        assertEquals("no hidden mode: the app is always in the launcher", 1, launcher.size)
    }

    private companion object {
        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
    }
}
