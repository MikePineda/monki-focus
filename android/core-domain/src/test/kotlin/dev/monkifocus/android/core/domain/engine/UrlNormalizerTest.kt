// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.fixtures.RulesPackage
import dev.monkifocus.android.core.domain.rules.NormalizedUrl
import dev.monkifocus.android.core.domain.rules.RejectedUrl
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.Surface
import dev.monkifocus.android.core.domain.rules.SurfaceKind
import dev.monkifocus.android.core.domain.rules.UrlRejection
import org.junit.Assert.assertEquals
import org.junit.Test

/** SEMANTICS.md §2 beyond the `url-normalize` fixtures (same cases as `UrlNormalizer.test.ts`). */
class UrlNormalizerTest {
    private val catalog = RulesPackage.catalog
    private val invalidHost = RejectedUrl(UrlRejection.INVALID_HOST)

    /** A synthetic catalog: aliases of one site and two equally specific globs. */
    private val synthetic =
        RulesCatalog(
            siteProfiles =
                listOf(
                    SiteProfile(
                        1,
                        "video.example",
                        listOf("vod.example", "vid.example", "old.vid.example"),
                        "history",
                        mapOf("video.b_feed" to listOf("/watch/*"), "video.a_feed" to listOf("/*/clip")),
                    ),
                ),
            surfaces = listOf(Surface("video.a_feed", "video", SurfaceKind.FEED), Surface("video.b_feed", "video", SurfaceKind.FEED)),
            defaultCategories = emptyList(),
        )

    @Test
    fun strips_scheme_www_and_mobile_prefix() {
        assertEquals("reddit.com", (normalizeUrl("https://www.reddit.com/r/x", catalog) as NormalizedUrl).host)
        assertEquals("youtube.com", (normalizeUrl("m.youtube.com/watch", catalog) as NormalizedUrl).host)
    }

    @Test
    fun text_without_slash_marks_path_unknown() {
        assertEquals(NormalizedUrl("news.example.org", "/", pathKnown = false, surface = null), normalizeUrl("news.example.org", catalog))
    }

    @Test
    fun idn_domain_is_normalised_to_punycode() {
        assertEquals("xn--bcher-kva.example", (normalizeUrl("https://bücher.example/", catalog) as NormalizedUrl).host)
    }

    @Test
    fun rejects_a_host_with_an_empty_label() {
        assertEquals(invalidHost, normalizeUrl("https://a..example/x", catalog))
    }

    @Test
    fun rejects_text_the_whatwg_parser_refuses() {
        assertEquals(invalidHost, normalizeUrl("https://exa mple.org/", catalog))
    }

    @Test
    fun rejects_a_single_label_host_such_as_localhost() {
        assertEquals(invalidHost, normalizeUrl("http://localhost:3000/", catalog))
    }

    @Test
    fun treats_a_dotted_prefix_before_a_colon_as_a_host_not_a_scheme() {
        assertEquals(NormalizedUrl("news.example.org", "/today", true, null), normalizeUrl("news.example.org:8080/today", catalog))
    }

    @Test
    fun trims_white_space_like_ecmascript() {
        assertEquals("reddit.com", (normalizeUrl(" ﻿ https://reddit.com/ 　", catalog) as NormalizedUrl).host)
    }

    @Test
    fun equally_specific_globs_resolve_to_the_smallest_surface_id() {
        assertEquals("video.a_feed", (normalizeUrl("https://video.example/watch/clip", synthetic) as NormalizedUrl).surface)
    }

    @Test
    fun the_longest_alias_suffix_is_rewritten_first() {
        val old = normalizeUrl("https://www.old.vid.example/watch/x", synthetic) as NormalizedUrl
        assertEquals("video.example" to "video.b_feed", old.host to old.surface)
        val mobile = normalizeUrl("https://m.vid.example/", synthetic) as NormalizedUrl
        assertEquals("video.example" to null, mobile.host to mobile.surface)
    }

    @Test
    fun a_dot_segment_hidden_in_an_escape_makes_the_path_unknown() {
        assertEquals(true, (normalizeUrl("https://reddit.com/r/%2E%2Ex", catalog) as NormalizedUrl).pathKnown)
        assertEquals(NormalizedUrl("reddit.com", "/r/x%2Fy", false, null), normalizeUrl("https://reddit.com/r/x%2Fy", catalog))
    }

    @Test
    fun an_unregistered_surface_has_no_kind() {
        assertEquals(null, synthetic.surfaceKind("video.unknown"))
        assertEquals(SurfaceKind.FEED, synthetic.surfaceKind("video.a_feed"))
    }

    @Test
    fun a_host_without_a_profile_has_none() {
        assertEquals(null, synthetic.profileForHost("news.example.org"))
    }
}
