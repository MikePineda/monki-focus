// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import android.content.Context
import android.content.res.Configuration
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.core.ui.R
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.util.Locale

@RunWith(RobolectricTestRunner::class)
class GateCatalogWiringTest {
    @Test
    fun gate_close_label_comes_from_the_shared_catalog_in_both_languages() {
        val context = ApplicationProvider.getApplicationContext<Context>()

        assertEquals("Close", context.inLocale("en").getString(R.string.action_close))
        assertEquals("Cerrar", context.inLocale("es").getString(R.string.action_close))
    }

    private fun Context.inLocale(tag: String): Context =
        createConfigurationContext(Configuration(resources.configuration).apply { setLocale(Locale.forLanguageTag(tag)) })
}
