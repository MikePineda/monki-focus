// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.web

import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteTarget

/**
 * Which first path segments the statistics may keep (an allowlist). A first
 * segment is often an identifier rather than a section (a profile name, a
 * phone number, a meeting code), so it is kept only when a rule names it as a
 * literal: a surface glob of the bundled site profiles (the glob of subreddit pages keeps `r` on
 * reddit.com, `/watch` → `watch` on youtube.com), a default category path, or
 * one of the user's category path rules. Anything else is stored as the domain
 * alone. Literal segments compare ASCII case-insensitively, like globs.
 *
 * Thread-safe: [allows] runs on the main thread, [update] wherever the rule
 * set was read. Until the user's rules are read only the bundled ones count
 * (the stricter list).
 */
class KnownSections(
    private val catalog: RulesCatalog,
) {
    private val bundled: List<Pair<String, String>> =
        catalog.profiles.flatMap { profile ->
            profile.surfaces.flatMap { it.globs }.mapNotNull { glob -> literalFirstSegment(glob)?.let { profile.domain to it } }
        } + sectionsOf(catalog.defaultCategories)

    @Volatile
    private var fromUser: List<Pair<String, String>> = emptyList()

    /** The user's category assignments in force (their site path rules join the list). */
    fun update(userCategories: List<CategoryAssignment>) {
        fromUser = sectionsOf(userCategories)
    }

    /** Whether [segment] (without slashes) of a page on [host] is a known section. */
    fun allows(
        host: String,
        segment: String,
    ): Boolean {
        val lowered = segment.lowercase()
        return (bundled + fromUser).any { (domain, section) -> section == lowered && isDomainOrSubdomain(host.lowercase(), domain) }
    }

    private fun sectionsOf(assignments: List<CategoryAssignment>): List<Pair<String, String>> =
        assignments.mapNotNull { assignment ->
            val target = assignment.target as? SiteTarget ?: return@mapNotNull null
            val section = target.path?.let(::literalFirstSegment) ?: return@mapNotNull null
            catalog.normaliseDomain(target.domain).lowercase() to section
        }

    private fun isDomainOrSubdomain(
        host: String,
        domain: String,
    ): Boolean = host == domain || host.endsWith(".$domain")

    private companion object {
        /** The first segment of a path glob when it is a literal (not `*`, `**` or the root). */
        fun literalFirstSegment(glob: String): String? =
            glob
                .removePrefix("/")
                .substringBefore('/')
                .takeIf { it.isNotEmpty() && '*' !in it }
                ?.lowercase()
    }
}
