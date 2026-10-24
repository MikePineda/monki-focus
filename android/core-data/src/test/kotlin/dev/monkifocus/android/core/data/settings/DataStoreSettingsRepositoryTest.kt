// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.settings

import dev.monkifocus.android.core.domain.ports.LanguagePreference
import dev.monkifocus.android.core.domain.ports.Settings
import dev.monkifocus.android.core.domain.ports.ThemePreference
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test

class DataStoreSettingsRepositoryTest {
    @get:Rule
    val temporary = TemporarySettingsStore()

    private var issued = 0
    private val repository by lazy { DataStoreSettingsRepository(temporary.store) { "device-${++issued}" } }

    @Test
    fun settings_default_to_the_private_choice() =
        runTest {
            val settings = repository.current()

            assertEquals(Settings(), settings)
            assertFalse(settings.storeTitles)
            assertEquals(ThemePreference.SYSTEM, settings.theme)
        }

    @Test
    fun an_update_is_stored_and_observed() =
        runTest {
            val stored =
                repository.update {
                    it.copy(
                        theme = ThemePreference.DARK,
                        language = LanguagePreference.SPANISH,
                        storeTitles = true,
                    )
                }

            assertEquals(stored, repository.current())
            assertEquals(stored, repository.settings.first())
            assertEquals(ThemePreference.DARK, stored.theme)
        }

    @Test
    fun device_id_is_created_once_and_kept() =
        runTest {
            val first = repository.deviceId()
            val second = repository.deviceId()

            assertEquals("device-1", first)
            assertEquals(first, second)
            assertEquals(1, issued)
        }
}
