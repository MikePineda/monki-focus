// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized
import java.io.File

/**
 * Replays every sanitised dump of `packages/rules/fixtures/detectors/android`
 * through the bundled packs and checks its `.expect.json` sidecar: the
 * surface (and the deciding tier), the guarded screen for Settings dumps and
 * the URL bar reading for browser dumps.
 */
@RunWith(Parameterized::class)
class UiDumpFixturesTest(
    private val name: String,
    private val dump: File,
) {
    private val expect: JsonObject =
        Json.parseToJsonElement(File(dump.path.removeSuffix(".xml") + ".expect.json").readText()).jsonObject
    private val screen = RulesResources.screen(name)

    @Test
    fun classifies_surface_from_fixture() {
        val match = SurfaceClassifier().classify(screen, RulesResources.bundledPacks)

        assertEquals(name, expect.string("surface"), match?.surface)
        expect.string("basis")?.let { assertEquals(name, it, match?.basis?.name?.lowercase()) }
    }

    @Test
    fun guarded_screen_matches_fixture() {
        if ("guarded" !in expect) return
        val classifier = SettingsScreenClassifier(RulesResources.bundledPack("settings"), ownLabels = setOf(OWN_LABEL))

        assertEquals(name, expect.string("guarded"), classifier.classify(screen)?.surfaceId)
    }

    @Test
    fun url_bar_reading_matches_fixture() {
        val urlBar = expect.string("urlBar") ?: return
        val reading = BrowserUrlExtractor.read(screen, RulesResources.bundledPack("browsers"))

        when (urlBar) {
            "shown" -> assertEquals(name, expect.string("urlText"), (reading as UrlBarReading.Shown).urlText)
            "editing" -> assertEquals(name, UrlBarReading.BeingEdited, reading)
            else -> assertEquals(name, UrlBarReading.Absent, reading)
        }
    }

    @Test
    fun fixture_is_marked_sanitized_and_generic() {
        assertTrue(name, RulesResources.dump(name).isSanitized)
        assertEquals(name, "generic", expect.string("device"))
    }

    private fun JsonObject.string(key: String): String? = this[key]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull

    companion object {
        /** The app label of `:core-ui` (`app_name`), which the guarded fixtures show. */
        const val OWN_LABEL = "monki-focus"

        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun dumps(): List<Array<Any>> = RulesResources.dumps.map { arrayOf(RulesResources.dumpName(it), it) }
    }
}
