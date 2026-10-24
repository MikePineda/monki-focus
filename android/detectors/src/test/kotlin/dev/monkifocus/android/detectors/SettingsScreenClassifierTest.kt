// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class SettingsScreenClassifierTest {
    private val classifier = SettingsScreenClassifier(RulesResources.bundledPack("settings"), ownLabels = setOf("monki-focus"))

    private fun guardOf(dump: String): GuardedScreen? = classifier.classify(RulesResources.screen(dump))

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
    fun our_label_in_the_device_language_is_matched() {
        val translated =
            SettingsScreenClassifier(RulesResources.bundledPack("settings"), ownLabels = setOf("monki-focus (es)", " monki-focus "))

        assertEquals(GuardedScreen.APP_INFO, translated.classify(RulesResources.screen("com.android.settings/synthetic/app_info-01.xml")))
    }

    @Test
    fun an_app_screen_is_never_a_guarded_screen() {
        assertNull(guardOf("com.instagram.android/synthetic/reels-01.xml"))
    }

    @Test
    fun own_labels_are_required() {
        assertThrows(IllegalArgumentException::class.java) {
            SettingsScreenClassifier(RulesResources.bundledPack("settings"), ownLabels = setOf(" "))
        }
    }
}
