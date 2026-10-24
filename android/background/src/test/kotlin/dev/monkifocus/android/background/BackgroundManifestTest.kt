// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background

import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/** Local-first: background work never reaches the network before the server phase. */
class BackgroundManifestTest {
    @Test
    fun background_work_requests_no_network_permission() {
        val moduleDir = File(requireNotNull(System.getProperty("monki.projectDir")) { "monki.projectDir is not set" })
        val manifest =
            DocumentBuilderFactory
                .newInstance()
                .apply { isNamespaceAware = true }
                .newDocumentBuilder()
                .parse(File(moduleDir, "src/main/AndroidManifest.xml"))

        val requested =
            listOf("uses-permission", "uses-permission-sdk-23")
                .flatMap { tag ->
                    val nodes = manifest.getElementsByTagName(tag)
                    (0 until nodes.length).map {
                        nodes
                            .item(it)
                            .attributes
                            .getNamedItemNS(ANDROID_NS, "name")
                            .nodeValue
                    }
                }

        assertEquals(emptyList<String>(), requested.filter { it in NETWORK_PERMISSIONS })
    }

    private companion object {
        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
        val NETWORK_PERMISSIONS = setOf("android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE")
    }
}
