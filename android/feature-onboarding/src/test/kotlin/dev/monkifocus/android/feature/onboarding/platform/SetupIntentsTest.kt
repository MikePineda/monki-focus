// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.platform

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SetupIntentsTest {
    private val service = ComponentName("dev.monkifocus.android", "dev.monkifocus.android.Service")

    @Test
    fun accessibility_opens_our_own_page_first_then_the_list() {
        val intents = SetupIntents.accessibility(service)

        assertEquals(
            listOf(Settings.ACTION_ACCESSIBILITY_DETAILS_SETTINGS, Settings.ACTION_ACCESSIBILITY_SETTINGS),
            intents.map { it.action },
        )
        assertEquals(service.flattenToString(), intents[0].getStringExtra(Intent.EXTRA_COMPONENT_NAME))
    }

    @Test
    fun app_info_usage_access_and_battery_name_our_package() {
        val pkg = "dev.monkifocus.android"

        assertEquals("package:$pkg", SetupIntents.appInfo(pkg).single().dataString)
        assertEquals("package:$pkg", SetupIntents.usageAccess(pkg).first().dataString)
        assertEquals(Settings.ACTION_USAGE_ACCESS_SETTINGS, SetupIntents.usageAccess(pkg).last().action)
        assertEquals(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, SetupIntents.batteryOptimisation(pkg).first().action)
        assertEquals(pkg, SetupIntents.notificationSettings(pkg).first().getStringExtra(Settings.EXTRA_APP_PACKAGE))
    }

    @Test
    fun device_admin_names_our_receiver_and_explains_itself() {
        val intent = SetupIntents.deviceAdmin(service, "explanation").single()

        assertEquals(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN, intent.action)
        assertEquals("explanation", intent.getStringExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION))
    }

    @Test
    fun progress_survives_in_its_preferences_file() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val progress = OnboardingProgress(step = OnboardingStep.BATTERY, disclosureAccepted = true)

        SharedPreferencesOnboardingStore(context).save(progress)

        assertEquals(progress, SharedPreferencesOnboardingStore(context).load())
    }
}
