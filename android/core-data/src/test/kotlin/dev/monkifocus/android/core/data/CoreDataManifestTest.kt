// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data

import org.junit.Assert.assertEquals
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The data layer is local-first: Room and DataStore need no permission. The
 * only one is usage access, which the user grants in system settings.
 */
class CoreDataManifestTest {
    @Test
    fun core_data_requests_only_usage_access() {
        val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
        val manifest =
            DocumentBuilderFactory
                .newInstance()
                .apply { isNamespaceAware = true }
                .newDocumentBuilder()
                .parse(File(moduleDir, "src/main/AndroidManifest.xml"))

        val requested =
            listOf("uses-permission", "uses-permission-sdk-23").flatMap { tag ->
                val nodes = manifest.getElementsByTagName(tag)
                (0 until nodes.length).map { (nodes.item(it) as Element).getAttributeNS(ANDROID_NS, "name") }
            }

        assertEquals(listOf("android.permission.PACKAGE_USAGE_STATS"), requested)
    }

    private companion object {
        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
    }
}
