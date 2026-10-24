// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.settings

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import dev.monkifocus.android.core.domain.ports.LanguagePreference
import dev.monkifocus.android.core.domain.ports.Settings
import dev.monkifocus.android.core.domain.ports.SettingsRepository
import dev.monkifocus.android.core.domain.ports.ThemePreference
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID

/**
 * [SettingsRepository] over a Preferences DataStore. Anything never written
 * reads as its default ([Settings]), so `storeTitles` is off until the user
 * turns it on. [settings] lets the UI observe changes.
 */
class DataStoreSettingsRepository(
    private val store: DataStore<Preferences>,
    private val newDeviceId: () -> String = { UUID.randomUUID().toString() },
) : SettingsRepository {
    val settings: Flow<Settings> = store.data.map(::settingsOf)

    override suspend fun current(): Settings = settings.first()

    override suspend fun update(transform: (Settings) -> Settings): Settings =
        settingsOf(
            store.edit { prefs -> write(prefs, transform(settingsOf(prefs))) },
        )

    override suspend fun deviceId(): String {
        store.data.first()[DEVICE_ID]?.let { return it }
        val prefs =
            store.edit { prefs ->
                if (prefs[DEVICE_ID] == null) {
                    val id = newDeviceId()
                    require(DEVICE_ID_FORMAT.matches(id)) { "Invalid device id" }
                    prefs[DEVICE_ID] = id
                }
            }
        return requireNotNull(prefs[DEVICE_ID])
    }

    private fun settingsOf(prefs: Preferences): Settings {
        val defaults = Settings()
        return Settings(
            theme = ThemePreference.ofCode(prefs[THEME]),
            language = LanguagePreference.ofCode(prefs[LANGUAGE]),
            storeTitles = prefs[STORE_TITLES] ?: defaults.storeTitles,
            syncActivityKey = prefs[SYNC_ACTIVITY] ?: defaults.syncActivityKey,
        )
    }

    private fun write(
        prefs: MutablePreferences,
        settings: Settings,
    ) {
        prefs[THEME] = settings.theme.code
        prefs[LANGUAGE] = settings.language.code
        prefs[STORE_TITLES] = settings.storeTitles
        prefs[SYNC_ACTIVITY] = settings.syncActivityKey
    }

    private companion object {
        // Stored names are permanent: renaming one loses the user's choice.
        val THEME = stringPreferencesKey("ui.theme")
        val LANGUAGE = stringPreferencesKey("ui.language")
        val STORE_TITLES = booleanPreferencesKey("privacy.store_titles")
        val SYNC_ACTIVITY = booleanPreferencesKey("privacy.sync_activity_names")
        val DEVICE_ID = stringPreferencesKey("device.id")
        val DEVICE_ID_FORMAT = Regex("^[A-Za-z0-9_-]{1,64}$")
    }
}
