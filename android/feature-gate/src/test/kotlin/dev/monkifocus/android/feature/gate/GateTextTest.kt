// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import android.content.Context
import android.content.res.Configuration
import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.util.Locale

@RunWith(RobolectricTestRunner::class)
class GateTextTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @Test
    fun every_engine_explanation_key_resolves_to_its_decision_string() {
        ExplanationKey.entries.forEach { key ->
            val id = explanationTextRes(key)

            assertEquals(key.key.replace('.', '_'), context.resources.getResourceEntryName(id))
            assertTrue("$key in English", context.inLocale("en").getString(id).isNotBlank())
            assertTrue("$key in Spanish", context.inLocale("es").getString(id).isNotBlank())
        }
    }

    @Test
    fun every_pause_type_has_its_why_line() {
        FrictionType.entries.forEach { type ->
            val name = context.resources.getResourceEntryName(whyTextRes(type))

            assertEquals("why_${type.name.lowercase(Locale.ROOT)}", name)
        }
    }

    private fun Context.inLocale(tag: String): Context =
        createConfigurationContext(Configuration(resources.configuration).apply { setLocale(Locale.forLanguageTag(tag)) })
}
