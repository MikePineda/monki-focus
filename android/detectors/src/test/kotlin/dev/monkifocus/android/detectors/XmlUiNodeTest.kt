// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class XmlUiNodeTest {
    private fun dump(name: String): XmlUiDump =
        requireNotNull(javaClass.getResourceAsStream("/uidump/$name")) { "missing fixture $name" }
            .use { XmlUiDump.parse(it) }

    @Test
    fun parses_a_sanitized_uiautomator_dump() {
        val dump = dump("synthetic-feed-01.xml")
        val root = dump.root

        assertTrue(dump.isSanitized)
        assertEquals("android.widget.FrameLayout", root.className)
        assertEquals("com.example.feed", root.packageName)
        assertEquals(Rect(0, 0, 1080, 2400), root.bounds)
        assertEquals(2, root.children.size)

        val feed = root.findByViewId("com.example.feed:id/feed_list").single()
        assertEquals(Rect(0, 210, 1080, 2190), feed.bounds)
        assertTrue(feed.isVisibleToUser)

        val tab = root.findByViewId("com.example.feed:id/home_tab").single()
        assertTrue(tab.isSelected)
        assertFalse(tab.isFocused)
        assertEquals("⟨t⟩", tab.contentDescription)
    }

    @Test
    fun missing_attributes_fall_back_to_uiautomator_defaults() {
        val root = dump("synthetic-feed-01.xml").root
        val header = root.findByViewId("com.example.feed:id/header").single()

        // uiautomator omits visible-to-user on older releases: visible by default.
        assertTrue(header.isVisibleToUser)
        assertEquals(null, header.text)
    }

    @Test
    fun dump_with_a_doctype_is_rejected() {
        val hostile =
            """<?xml version="1.0"?><!DOCTYPE hierarchy [<!ENTITY x SYSTEM "file:///etc/hosts">]>""" +
                """<hierarchy><node text="&x;" bounds="[0,0][1,1]"/></hierarchy>"""

        assertThrows(Exception::class.java) { XmlUiDump.parse(hostile.byteInputStream()) }
    }
}
