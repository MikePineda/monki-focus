// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.settings

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStoreFile

/**
 * The settings file in the app's private storage (excluded from backup and
 * device transfer). DataStore allows one instance per file: the composition
 * root calls this once and shares the result.
 */
object SettingsDataStoreFactory {
    const val FILE_NAME = "monki_settings"

    fun open(context: Context): DataStore<Preferences> =
        PreferenceDataStoreFactory.create(produceFile = { context.applicationContext.preferencesDataStoreFile(FILE_NAME) })
}
