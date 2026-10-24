// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.validation

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.JsonNodeFactory

/*
 * Normalisation of rule targets for validation (uniqueness and domain
 * checks), as `packages/rules/src/TargetNormaliser.ts` does it and
 * SEMANTICS.md §1 and §3.1 describe it. The alias map (alias domain →
 * canonical domain) comes from the site profiles, in their order.
 */

/** Second-level labels that, under a two-letter country TLD, form a public suffix (`co.uk`). */
private val PUBLIC_SECOND_LEVEL_LABELS = setOf("ac", "co", "com", "edu", "gov", "net", "org")

/** Drops one leading `www.` or `m.` label, then rewrites an alias suffix to its canonical domain. */
internal fun normaliseDomainForValidation(
    domain: String,
    aliases: Map<String, String>,
): String {
    var host = domain.lowercase()
    if (host.startsWith("www.") || host.startsWith("m.")) host = host.substring(host.indexOf('.') + 1)
    for ((alias, canonical) in aliases) {
        if (host == alias) return canonical
        if (host.endsWith(".$alias")) return host.dropLast(alias.length) + canonical
    }
    return host
}

/** A normalised domain needs two labels and must not be a bare public suffix such as `co.uk`. */
internal fun isRegistrableDomain(
    domain: String,
    aliases: Map<String, String>,
): Boolean {
    val labels = normaliseDomainForValidation(domain, aliases).split('.')
    if (labels.size < 2) return false
    val second = labels[labels.size - 2]
    val top = labels[labels.size - 1]
    val isPublicSuffix = labels.size == 2 && top.length == 2 && second in PUBLIC_SECOND_LEVEL_LABELS
    return !isPublicSuffix
}

/**
 * The value two targets are compared by for uniqueness: normalised domain,
 * lower-cased glob (globs compare case-insensitively) and the catch-all glob as no path.
 * Values that are not site targets are returned unchanged.
 */
internal fun canonicalTarget(
    value: JsonNode?,
    aliases: Map<String, String>,
): JsonNode? {
    if (value == null || !value.isObject) return value
    val kind = value.get("kind")
    val domain = value.get("domain")
    if (kind == null || !kind.isTextual || kind.asText() != "site" || domain == null || !domain.isTextual) return value
    val canonical = JsonNodeFactory.instance.objectNode()
    canonical.put("kind", "site")
    canonical.put("domain", normaliseDomainForValidation(domain.asText(), aliases))
    val path = value.get("path")
    if (path != null && path.isTextual && path.asText() != "/**") canonical.put("path", path.asText().lowercase())
    return canonical
}
