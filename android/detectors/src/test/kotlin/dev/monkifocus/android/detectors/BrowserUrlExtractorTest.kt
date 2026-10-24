// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.engine.normalizeUrl
import dev.monkifocus.android.core.domain.rules.NormalizedUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class BrowserUrlExtractorTest {
    private val browsers = RulesResources.bundledPack("browsers")

    private fun read(dump: String): UrlBarReading = BrowserUrlExtractor().read(RulesResources.screen(dump), browsers)

    @Test
    fun chrome_url_bar_text_is_returned_raw() {
        assertEquals(UrlBarReading.Shown("example.com/r/sample/comments/1"), read("com.android.chrome/synthetic/url-01.xml"))
    }

    @Test
    fun chrome_falls_back_to_omnibox_url_text() {
        assertEquals(UrlBarReading.Shown("https://example.org/feed"), read("com.android.chrome/synthetic/url-02.xml"))
    }

    @Test
    fun brave_url_bar_is_read_by_its_own_package_id() {
        assertEquals(UrlBarReading.Shown("example.org"), read("com.brave.browser/synthetic/url-01.xml"))
    }

    @Test
    fun domain_only_bar_reaches_the_normaliser_with_an_unknown_path() {
        val reading = read("com.brave.browser/synthetic/url-01.xml") as UrlBarReading.Shown

        val normalized = normalizeUrl(reading.urlText, RulesResources.catalog) as NormalizedUrl

        assertEquals("example.org", normalized.host)
        assertFalse(normalized.pathKnown)
    }

    @Test
    fun focused_url_bar_text_is_ignored() {
        assertEquals(UrlBarReading.BeingEdited, read("com.android.chrome/synthetic/url-03.xml"))
    }

    @Test
    fun reads_only_the_url_bar_node_text() {
        val reads = mutableListOf<String>()
        val bar = TestNode("com.brave.browser:id/url_bar", textValue = "example.org", bounds = Rect(130, 100, 900, 200), textReads = reads)
        val page = TestNode("com.brave.browser:id/page", textValue = "page text", contentDescValue = "page", textReads = reads)
        val screen = window("com.brave.browser", page, bar)

        BrowserUrlExtractor().read(screen, browsers)

        assertEquals(listOf("text:com.brave.browser:id/url_bar"), reads.distinct())
    }

    @Test
    fun another_browsers_url_bar_id_is_not_read() {
        val screen =
            window(
                "com.brave.browser",
                TestNode("com.android.chrome:id/url_bar", textValue = "example.org", bounds = Rect(130, 100, 900, 200)),
            )

        assertEquals(UrlBarReading.Absent, BrowserUrlExtractor().read(screen, browsers))
    }

    @Test
    fun a_package_outside_the_browser_pack_is_absent() {
        val screen = window("com.example.reader", TestNode("com.example.reader:id/url_bar", textValue = "example.org"))

        assertEquals(UrlBarReading.Absent, BrowserUrlExtractor().read(screen, browsers))
    }

    @Test
    fun a_url_reading_never_prints_the_url() {
        assertFalse(UrlBarReading.Shown("example.org/private").toString().contains("example"))
    }

    @Test
    fun a_page_element_named_like_the_url_bar_is_never_read() {
        assertEquals(UrlBarReading.Shown("example.org"), read("com.brave.browser/synthetic/url-02.xml"))
        assertEquals(UrlBarReading.Absent, read("com.brave.browser/synthetic/url-03.xml"))
    }

    @Test
    fun a_spoofed_bar_inside_a_web_view_is_ignored_even_alone() {
        val page =
            TestNode(
                className = "android.webkit.WebView",
                bounds = Rect(0, 220, 1080, 2400),
                children = listOf(TestNode("com.brave.browser:id/url_bar", textValue = SPOOFED, bounds = Rect(40, 420, 1040, 520))),
            )

        assertEquals(UrlBarReading.Absent, BrowserUrlExtractor().read(window("com.brave.browser", page), browsers))
    }

    private companion object {
        const val SPOOFED = "https://example.net/spoofed"
    }

    @Test
    fun firefox_compose_url_box_is_read_by_its_bare_tag() {
        val box = TestNode("ADDRESSBAR_URL_BOX", textValue = "example.org", bounds = Rect(130, 100, 900, 200))

        assertEquals(UrlBarReading.Shown("example.org"), BrowserUrlExtractor().read(window("org.mozilla.firefox", box), browsers))
    }
}
