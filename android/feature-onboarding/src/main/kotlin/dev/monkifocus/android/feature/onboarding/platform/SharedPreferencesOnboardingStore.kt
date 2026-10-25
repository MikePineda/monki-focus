// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.platform

import android.content.Context
import android.content.SharedPreferences
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgressCodec
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStore

/**
 * [OnboardingStore] in its own private preferences file, one line of
 * [OnboardingProgressCodec] text written synchronously (the app may be
 * killed while a Settings screen is open). Backups are off for the app.
 */
class SharedPreferencesOnboardingStore(
    context: Context,
) : OnboardingStore {
    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override fun load(): OnboardingProgress = OnboardingProgressCodec.decode(prefs.getString(KEY_PROGRESS, null))

    override fun save(progress: OnboardingProgress) {
        prefs.edit().putString(KEY_PROGRESS, OnboardingProgressCodec.encode(progress)).commit()
    }

    private companion object {
        const val FILE = "monki_onboarding"
        const val KEY_PROGRESS = "progress"
    }
}
