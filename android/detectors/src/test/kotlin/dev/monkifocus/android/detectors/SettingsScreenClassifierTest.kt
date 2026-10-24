// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class SettingsScreenClassifierTest {
    private val ours = "dev.monkifocus.android"
    private val settingsPack = RulesResources.bundledPack("settings")
    private val classifier = SettingsScreenClassifier(settingsPack, ownLabels = setOf("monki-focus"), ourPackage = ours)

    private fun guardOf(
        dump: String,
        labelCollision: Boolean = false,
    ): GuardedScreen? = classifier.classify(RulesResources.screen(dump), labelCollision)

    @Test
    fun device_admin_deactivation_is_guarded() {
        assertEquals(GuardedScreen.DEVICE_ADMIN, guardOf("com.android.settings/synthetic/device_admin-01.xml"))
    }

    @Test
    fun our_accessibility_detail_is_guarded() {
        assertEquals(GuardedScreen.ACCESSIBILITY_DETAIL, guardOf("com.android.settings/synthetic/accessibility_detail-01.xml"))
    }

    @Test
    fun other_apps_accessibility_detail_is_not_guarded() {
        assertNull(guardOf("com.android.settings/synthetic/accessibility_detail-02.xml"))
    }

    @Test
    fun accessibility_list_with_our_row_is_not_guarded() {
        // The list leads to every other service too: blocking it would break Settings.
        assertNull(guardOf("com.android.settings/synthetic/accessibility_list-01.xml"))
    }

    @Test
    fun our_app_info_is_guarded() {
        assertEquals(GuardedScreen.APP_INFO, guardOf("com.android.settings/synthetic/app_info-01.xml"))
    }

    @Test
    fun other_apps_info_is_not_guarded() {
        assertNull(guardOf("com.android.settings/synthetic/app_info-02.xml"))
    }

    @Test
    fun our_uninstall_dialog_is_guarded() {
        assertEquals(GuardedScreen.UNINSTALL, guardOf("com.google.android.packageinstaller/synthetic/uninstall-01.xml"))
    }

    @Test
    fun a_label_collision_releases_app_info_uninstall_and_device_admin() {
        assertNull(guardOf("com.android.settings/synthetic/app_info-01.xml", labelCollision = true))
        assertNull(guardOf("com.google.android.packageinstaller/synthetic/uninstall-01.xml", labelCollision = true))
        assertNull(guardOf("com.android.settings/synthetic/device_admin-01.xml", labelCollision = true))
        // Our accessibility service is identified by its own detail page, which a look-alike app cannot share.
        assertEquals(
            GuardedScreen.ACCESSIBILITY_DETAIL,
            guardOf("com.android.settings/synthetic/accessibility_detail-01.xml", labelCollision = true),
        )
    }

    private fun uninstallDialog(vararg extra: TestNode): Screen =
        window(
            "com.google.android.packageinstaller",
            TestNode("android:id/alertTitle", textValue = "monki-focus", bounds = Rect(120, 960, 960, 1060)),
            TestNode("android:id/message", textValue = "⟨t⟩", bounds = Rect(120, 1080, 960, 1260)),
            TestNode("android:id/button1", textValue = "⟨t⟩", bounds = Rect(700, 1320, 960, 1440)),
            *extra,
        )

    @Test
    fun uninstall_of_a_look_alike_package_is_not_guarded() {
        val lookAlike = uninstallDialog(TestNode(textValue = "com.example.lookalike", bounds = Rect(120, 1270, 960, 1310)))

        assertNull(classifier.classify(lookAlike, labelCollision = false))
    }

    @Test
    fun uninstall_showing_our_package_is_guarded() {
        val ownPackage = uninstallDialog(TestNode(textValue = ours, bounds = Rect(120, 1270, 960, 1310)))

        assertEquals(GuardedScreen.UNINSTALL, classifier.classify(ownPackage, labelCollision = false))
        assertEquals(GuardedScreen.UNINSTALL, classifier.classify(uninstallDialog(), labelCollision = false))
    }

    @Test
    fun our_label_in_the_device_language_is_matched() {
        val translated = SettingsScreenClassifier(settingsPack, ownLabels = setOf("monki-focus (es)", " monki-focus "), ourPackage = ours)

        assertEquals(
            GuardedScreen.APP_INFO,
            translated.classify(RulesResources.screen("com.android.settings/synthetic/app_info-01.xml"), labelCollision = false),
        )
    }

    @Test
    fun an_app_screen_is_never_a_guarded_screen() {
        assertNull(guardOf("com.instagram.android/synthetic/reels-01.xml"))
    }

    @Test
    fun own_labels_and_package_are_required() {
        assertThrows(
            IllegalArgumentException::class.java,
        ) { SettingsScreenClassifier(settingsPack, ownLabels = setOf(" "), ourPackage = ours) }
        assertThrows(IllegalArgumentException::class.java) {
            SettingsScreenClassifier(settingsPack, ownLabels = setOf("monki-focus"), ourPackage = "not a package")
        }
    }
}
