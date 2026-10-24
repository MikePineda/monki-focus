// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.CategoryAssignment
import dev.monkifocus.android.core.domain.rules.SiteProfile
import dev.monkifocus.android.core.domain.rules.Surface
import dev.monkifocus.android.core.domain.rules.SurfaceKind

/**
 * The bundled rules data the engine needs, passed in rather than read from
 * disk so the engine stays pure: site profiles (aliases and surface globs),
 * the surface registry (feed / permalink / utility) and the default category
 * assignments. Adapters build it once from the `packages/rules` data.
 */
class RulesCatalog(
    siteProfiles: List<SiteProfile>,
    surfaces: List<Surface>,
    val defaultCategories: List<CategoryAssignment>,
) {
    /** One surface of a profile with its globs. */
    data class ProfileSurface(
        val surface: String,
        val globs: List<String>,
    )

    /** A site profile with its surfaces in id order. */
    data class CompiledProfile(
        val domain: String,
        val surfaces: List<ProfileSurface>,
    )

    /** Alias → canonical domain, longest alias first. */
    val aliases: List<Pair<String, String>>

    /** Longest domain first: a profile for a subdomain wins over its parent's. */
    val profiles: List<CompiledProfile>

    private val kinds: Map<String, SurfaceKind> = surfaces.associate { it.id to it.kind }

    init {
        val aliasMap = LinkedHashMap<String, String>()
        for (profile in siteProfiles) for (alias in profile.aliases) aliasMap[alias] = profile.domain
        aliases = aliasTableOf(aliasMap)
        profiles =
            siteProfiles
                .map { profile ->
                    CompiledProfile(
                        domain = profile.domain,
                        surfaces = profile.surfaces.map { (surface, globs) -> ProfileSurface(surface, globs) }.sortedBy { it.surface },
                    )
                }.sortedByDescending { it.domain.length }
    }

    /** Kind of a registered surface, or null for an unknown id. */
    fun surfaceKind(surface: String): SurfaceKind? = kinds[surface]

    /** §3.1 normalisation of a rule, category or unlock domain. */
    fun normaliseDomain(domain: String): String = normaliseDomain(domain, aliases)

    /** The profile whose domain equals the (normalised) host or is a dot-suffix of it. */
    fun profileForHost(host: String): CompiledProfile? = profiles.firstOrNull { isDomainOrSubdomain(host, it.domain) }
}
