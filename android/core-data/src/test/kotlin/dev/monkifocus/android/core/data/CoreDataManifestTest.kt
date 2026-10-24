// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/** The data layer is local-first: Room and DataStore need no permission at all. */
class CoreDataManifestTest {
    @Test
    fun core_data_requests_no_permissions() {
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
