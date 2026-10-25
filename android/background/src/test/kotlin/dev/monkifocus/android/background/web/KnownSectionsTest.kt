// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.SiteTarget
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KnownSectionsTest {
    private val catalog =
        RulesCatalog(
            siteProfiles =
                listOf(
                    SiteProfile(
                        schemaVersion = 1,
                        domain = "forum.example",
                        aliases = emptyList(),
                        spaNavigation = "none",
                        surfaces = mapOf("forum.feed" to listOf("/", "/r/*", "/hot"), "forum.post" to listOf("/*/status/**")),
                    ),
                ),
            surfaces = emptyList(),
            defaultCategories = listOf(CategoryAssignment(SiteTarget("video.example", "/watch"), 0, "video")),
        )
    private val sections = KnownSections(catalog)

    @Test
    fun literal_first_segments_of_profile_globs_are_sections() {
        assertTrue(sections.allows("forum.example", "r"))
        assertTrue(sections.allows("forum.example", "HOT"))
        assertTrue(sections.allows("m.forum.example", "hot"))
    }

    @Test
    fun a_wildcard_first_segment_names_nothing() {
        // `/*/status/**` matches profile pages, so the profile name in front is never a section.
        assertFalse(sections.allows("forum.example", "someone"))
        assertFalse(sections.allows("forum.example", "status"))
    }

    @Test
    fun a_section_belongs_to_its_own_domain() {
        assertFalse(sections.allows("other.example", "r"))
        assertFalse(sections.allows("notforum.example", "r"))
    }

    @Test
    fun default_and_user_category_paths_name_sections() {
        assertTrue(sections.allows("video.example", "watch"))
        assertFalse(sections.allows("docs.example", "handbook"))

        sections.update(listOf(CategoryAssignment(SiteTarget("docs.example", "/handbook/**"), 100, "work")))

        assertTrue(sections.allows("docs.example", "handbook"))
        sections.update(emptyList())
        assertFalse(sections.allows("docs.example", "handbook"))
    }
}
