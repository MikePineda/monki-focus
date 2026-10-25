// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.service.accessibility.action.CoverRegion
import dev.monkifocus.android.service.accessibility.support.RulesData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class UrlKeyTest {
    @Test
    fun only_the_host_the_first_path_segment_and_the_surface_are_kept() {
        val key = UrlKey.of("https://www.reddit.com/r/sample/comments/abc/a_title?utm=x#top", RulesData.catalog)

        assertEquals(UrlKey("reddit.com", "r", pathKnown = true, surface = "reddit.permalink"), key)
        assertFalse("no path past the first segment", "comments" in key.toString())
    }

    @Test
    fun a_bare_domain_has_an_unknown_path() {
        assertEquals(UrlKey("reddit.com", null, pathKnown = false, surface = null), UrlKey.of("reddit.com", RulesData.catalog))
    }

    @Test
    fun search_terms_and_browser_pages_are_rejected() {
        assertEquals(UrlKey.REJECTED, UrlKey.of("chrome://newtab", RulesData.catalog))
        assertEquals(UrlKey.REJECTED, UrlKey.of("how to cook rice", RulesData.catalog))
    }

    @Test
    fun a_site_observation_never_prints_its_url() {
        val observation = ScreenObservation.Site("com.android.chrome", UrlKey.REJECTED, CoverRegion(0, 1), "https://example.org/private")

        assertFalse("private" in observation.toString())
    }
}
