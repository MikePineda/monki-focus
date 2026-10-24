// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** `values/` (English) and `values-es/` (Spanish) must stay in lockstep. */
class StringCatalogParityTest {
    private val resDir =
        File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" }, "src/main/res")
    private val english = StringCatalog.read(File(resDir, "values"))
    private val spanish = StringCatalog.read(File(resDir, "values-es"))

    @Test
    fun string_catalogs_have_identical_keys() {
        assertTrue("the English catalog must not be empty", english.translatable.isNotEmpty())
        assertEquals(english.translatable.keys, spanish.translatable.keys)
        assertEquals(
            "translatable=\"false\" strings live only in values/",
            emptySet<String>(),
            spanish.untranslatable + english.untranslatable.intersect(spanish.translatable.keys),
        )
    }

    @Test
    fun string_catalogs_have_identical_placeholders() {
        english.translatable.forEach { (key, placeholders) ->
            assertEquals("placeholders of '$key'", placeholders, spanish.translatable[key])
        }
    }

    @Test
    fun core_ui_holds_the_only_string_catalog() {
        val androidDir = File(resDir, "../../../..").canonicalFile
        val strayCatalogs =
            androidDir
                .listFiles { module -> module.isDirectory && module.name != "core-ui" }
                .orEmpty()
                .flatMap { module -> File(module, "src").listFiles().orEmpty().map { File(it, "res") } }
                .flatMap { res -> res.listFiles { dir -> dir.name.startsWith("values") }.orEmpty().toList() }
                .filter { values -> StringCatalog.read(values).let { it.translatable.isNotEmpty() || it.untranslatable.isNotEmpty() } }
                .map { it.relativeTo(androidDir).path }

        assertEquals("move these strings to core-ui", emptyList<String>(), strayCatalogs)
    }
}
