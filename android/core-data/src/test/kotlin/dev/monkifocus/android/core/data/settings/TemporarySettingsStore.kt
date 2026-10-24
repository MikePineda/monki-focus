// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.settings

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.rules.ExternalResource
import org.junit.rules.TemporaryFolder
import java.io.File

/** A Preferences DataStore in a temporary folder, closed after the test. Pure JVM: no Android needed. */
class TemporarySettingsStore : ExternalResource() {
    private val folder = TemporaryFolder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val store: DataStore<Preferences> by lazy {
        PreferenceDataStoreFactory.create(scope = scope, produceFile = { File(folder.root, "settings.preferences_pb") })
    }

    override fun before() {
        folder.create()
    }

    override fun after() {
        scope.cancel()
        folder.delete()
    }
}
