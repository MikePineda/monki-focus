// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility

import dev.monkifocus.android.service.accessibility.support.RulesData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/** The accessibility service declaration and config (docs/threat-model.md, Android). */
class AccessibilityConfigTest {
    private val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })

    private fun parse(relative: String): Element =
        DocumentBuilderFactory
            .newInstance()
            .apply { isNamespaceAware = true }
            .newDocumentBuilder()
            .parse(File(moduleDir, relative))
            .documentElement

    private val config = parse("src/main/res/xml/accessibility_service_config.xml")

    private fun attr(name: String): String = config.getAttributeNS(ANDROID_NS, name)

    @Test
    fun the_service_watches_exactly_the_packages_of_the_bundled_packs() {
        val declared = attr("packageNames").split(',').map(String::trim).toSet()

        assertEquals(RulesData.packs.flatMap { it.packages }.toSet(), declared)
    }

    @Test
    fun the_service_reads_window_content_with_view_ids_and_two_window_events() {
        assertEquals("true", attr("canRetrieveWindowContent"))
        assertEquals(setOf("typeWindowStateChanged", "typeWindowContentChanged"), attr("accessibilityEventTypes").split('|').toSet())
        assertEquals("view ids only: no interactive windows", setOf("flagReportViewIds"), attr("accessibilityFlags").split('|').toSet())
        assertEquals("@string/accessibility_service_description", attr("description"))
    }

    @Test
    fun the_service_does_not_claim_to_be_an_accessibility_tool() {
        assertFalse(config.hasAttributeNS(ANDROID_NS, "isAccessibilityTool"))
    }

    @Test
    fun every_exported_component_is_guarded_by_a_system_permission() {
        val manifest = parse("src/main/AndroidManifest.xml")
        val exported =
            listOf("activity", "service", "receiver", "provider")
                .flatMap { tag ->
                    val nodes = manifest.getElementsByTagName(tag)
                    (0 until nodes.length).map { nodes.item(it) as Element }
                }.filter { it.getAttributeNS(ANDROID_NS, "exported") == "true" }
                .associate { it.getAttributeNS(ANDROID_NS, "name") to it.getAttributeNS(ANDROID_NS, "permission") }

        assertEquals(mapOf(".platform.MonkiAccessibilityService" to "android.permission.BIND_ACCESSIBILITY_SERVICE"), exported)
    }

    private companion object {
        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
    }
}
