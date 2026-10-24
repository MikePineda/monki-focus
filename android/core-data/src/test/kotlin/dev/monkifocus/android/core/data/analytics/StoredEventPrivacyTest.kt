// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.analytics

import dev.monkifocus.android.core.domain.analytics.EventData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StoredEventPrivacyTest {
    @Test
    fun url_data_keeps_the_first_path_segment_at_most() {
        assertEquals("/watch", StoredEventPrivacy.firstSegmentOf("/watch/abc123"))
        assertEquals("/r", StoredEventPrivacy.firstSegmentOf("/r/example/comments/xyz"))
        assertEquals("/watch", StoredEventPrivacy.firstSegmentOf("/watch?v=abc#t=1"))
        assertEquals("/", StoredEventPrivacy.firstSegmentOf("/"))
        assertEquals("/", StoredEventPrivacy.firstSegmentOf("/?q=private"))
        assertEquals("/", StoredEventPrivacy.firstSegmentOf(""))
    }

    @Test
    fun titles_are_dropped_unless_the_setting_is_on() {
        val window = EventData.Window("com.example.video", "A title")

        assertNull((StoredEventPrivacy.reduce(window, storeTitles = false) as EventData.Window).title)
        assertEquals("A title", (StoredEventPrivacy.reduce(window, storeTitles = true) as EventData.Window).title)
    }

    @Test
    fun incognito_titles_are_never_kept() {
        val tab = EventData.WebTab("example.com", "/feed/today", null, audible = false, incognito = true, title = "Private")

        val stored = StoredEventPrivacy.reduce(tab, storeTitles = true) as EventData.WebTab

        assertNull(stored.title)
        assertEquals("/feed", stored.path)
    }
}
