// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The accessibility module reads the screen, so it must not also be able to
 * send anything anywhere: no permission requests of its own (the service is
 * bound by the system through BIND_ACCESSIBILITY_SERVICE).
 */
class AccessibilityManifestTest {
    @Test
    fun accessibility_module_requests_no_permissions() {
        val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
        val manifest =
            DocumentBuilderFactory
                .newInstance()
                .apply { isNamespaceAware = true }
                .newDocumentBuilder()
                .parse(File(moduleDir, "src/main/AndroidManifest.xml"))

        val requested =
            listOf("uses-permission", "uses-permission-sdk-23")
                .sumOf { manifest.getElementsByTagName(it).length }

        assertEquals(0, requested)
    }
}
