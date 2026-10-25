// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Restricted settings, the OEM battery advice and the stored progress. */
class SetupFactsTest {
    @Test
    fun restricted_settings_exist_only_from_android_13() {
        assertEquals(RestrictedSettings.NOT_APPLICABLE, RestrictedSettings.assess(sdkInt = 32, installer = null, opMode = 2))
    }

    @Test
    fun the_app_op_decides_when_it_can_be_read() {
        assertEquals(RestrictedSettings.ALLOWED, RestrictedSettings.assess(36, installer = null, opMode = 0))
        assertEquals(RestrictedSettings.RESTRICTED, RestrictedSettings.assess(36, installer = "com.android.vending", opMode = 2))
        assertEquals(RestrictedSettings.RESTRICTED, RestrictedSettings.assess(33, installer = null, opMode = 1))
    }

    @Test
    fun without_the_app_op_the_installer_is_the_best_guess() {
        assertEquals(RestrictedSettings.PROBABLY_ALLOWED, RestrictedSettings.assess(35, installer = "com.android.vending", opMode = null))
        assertEquals(RestrictedSettings.PROBABLY_RESTRICTED, RestrictedSettings.assess(35, installer = "com.example.files", opMode = null))
        assertEquals(RestrictedSettings.PROBABLY_RESTRICTED, RestrictedSettings.assess(35, installer = null, opMode = null))
        assertEquals(RestrictedSettings.PROBABLY_RESTRICTED, RestrictedSettings.assess(35, installer = null, opMode = 3))
    }

    @Test
    fun battery_advice_follows_the_maker_with_a_generic_fallback() {
        assertEquals(BatteryGuidance.SAMSUNG, BatteryGuidance.forManufacturer("samsung"))
        assertEquals(BatteryGuidance.XIAOMI, BatteryGuidance.forManufacturer("Xiaomi"))
        assertEquals(BatteryGuidance.XIAOMI, BatteryGuidance.forManufacturer("POCO"))
        assertEquals(BatteryGuidance.HUAWEI, BatteryGuidance.forManufacturer("HONOR"))
        assertEquals(BatteryGuidance.GENERIC, BatteryGuidance.forManufacturer("Google"))
        assertEquals(BatteryGuidance.GENERIC, BatteryGuidance.forManufacturer(null))
        assertEquals(BatteryGuidance.OPPO, BatteryGuidance.forManufacturer("OnePlus").steps)
        assertEquals("https://dontkillmyapp.com/oneplus", BatteryGuidance.forManufacturer("OnePlus").url)
        BatteryGuidance.entries.forEach { assertTrue(it.url, it.url.startsWith("https://dontkillmyapp.com/")) }
    }

    @Test
    fun stored_progress_round_trips() {
        val progress =
            OnboardingProgress(
                step = OnboardingStep.BATTERY,
                disclosureAccepted = true,
                attempted = setOf(OnboardingStep.ACCESSIBILITY, OnboardingStep.NOTIFICATIONS),
                completed = true,
            )
        val statsOnly = OnboardingProgress(step = OnboardingStep.USAGE_ACCESS, disclosureDeclined = true, mode = OnboardingMode.STATS_ONLY)

        assertEquals(progress, OnboardingProgressCodec.decode(OnboardingProgressCodec.encode(progress)))
        assertEquals(statsOnly, OnboardingProgressCodec.decode(OnboardingProgressCodec.encode(statsOnly)))
        assertEquals(OnboardingProgress(), OnboardingProgressCodec.decode(OnboardingProgressCodec.encode(OnboardingProgress())))
    }

    @Test
    fun unreadable_progress_starts_over() {
        listOf(null, "", "v9|x", "v1|NOPE|1|0|PROTECTION||0", "v1|BATTERY|1|0|NOPE||0").forEach {
            assertEquals(it.toString(), OnboardingProgress(), OnboardingProgressCodec.decode(it))
        }
    }

    @Test
    fun a_disclosure_accepted_in_another_version_is_asked_again() {
        val older = "v1|TURN_ON|0|0|PROTECTION|ACCESSIBILITY|1"
        val olderVersion = "v1|BATTERY|7|0|PROTECTION||0"

        val again = OnboardingProgressCodec.decode(older)
        assertEquals(OnboardingStep.DISCLOSURE, again.step)
        assertEquals(false, again.completed)
        assertEquals(OnboardingStep.DISCLOSURE, OnboardingProgressCodec.decode(olderVersion).step)
        assertEquals(false, OnboardingProgressCodec.decode(olderVersion).disclosureAccepted)
    }
}
