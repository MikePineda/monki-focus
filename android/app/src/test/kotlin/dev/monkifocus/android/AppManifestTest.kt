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
    fun merged_manifest_requests_no_network_permission_even_with_background_work() {
        @Suppress("DEPRECATION")
        val requested =
            application.packageManager
                .getPackageInfo(application.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                .orEmpty()
                .toList()

        assertFalse("android.permission.ACCESS_NETWORK_STATE" in requested)
    }

    @Test
    fun merged_manifest_requests_exactly_the_documented_permissions() {
        @Suppress("DEPRECATION")
        val requested =
            application.packageManager
                .getPackageInfo(application.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                .orEmpty()
                .toSet()

        assertEquals(
            setOf(
                "android.permission.POST_NOTIFICATIONS",
                "android.permission.QUERY_ALL_PACKAGES",
                "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
                "android.permission.PACKAGE_USAGE_STATS",
                // WorkManager: jobs survive a reboot and hold a wake lock while they run.
                "android.permission.WAKE_LOCK",
                "android.permission.RECEIVE_BOOT_COMPLETED",
                // AndroidX core's signature permission for receivers registered not exported.
                "${application.packageName}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
            ),
            requested,
        )
    }

    @Test
    fun merged_manifest_exports_only_the_launcher_and_system_guarded_components() {
        val components =
            PackageManager.GET_ACTIVITIES or PackageManager.GET_SERVICES or PackageManager.GET_RECEIVERS or PackageManager.GET_PROVIDERS

        @Suppress("DEPRECATION")
        val info = application.packageManager.getPackageInfo(application.packageName, components)
        val exported =
            (
                info.activities.orEmpty().map { it.exported to (it.name to it.permission) } +
                    info.services.orEmpty().map { it.exported to (it.name to it.permission) } +
                    info.receivers.orEmpty().map { it.exported to (it.name to it.permission) } +
                    info.providers.orEmpty().map { it.exported to (it.name to it.readPermission) }
            ).filter { (isExported, component) -> isExported && component.first !in DEBUG_ONLY_TOOLING }
                .associate { (_, component) -> component.first to component.second }

        assertEquals(
            mapOf(
                "dev.monkifocus.android.MainActivity" to null,
                "dev.monkifocus.android.MonkiDeviceAdminReceiver" to "android.permission.BIND_DEVICE_ADMIN",
                "dev.monkifocus.android.service.accessibility.platform.MonkiAccessibilityService" to
                    "android.permission.BIND_ACCESSIBILITY_SERVICE",
                "androidx.work.impl.background.systemjob.SystemJobService" to "android.permission.BIND_JOB_SERVICE",
            ),
            exported,
        )
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

        /** Compose preview and UI-test host activities: `debugImplementation` only, never in a release APK. */
        val DEBUG_ONLY_TOOLING = setOf("androidx.compose.ui.tooling.PreviewActivity", "androidx.activity.ComponentActivity")
    }
}
