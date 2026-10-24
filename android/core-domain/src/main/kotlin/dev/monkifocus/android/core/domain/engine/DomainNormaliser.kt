// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

/*
 * Host and domain normalisation (SEMANTICS.md §2 steps 5–6, §3.1): lower-case,
 * drop one trailing `.`, drop one leading `www.` or `m.` label, then rewrite a
 * site-profile alias suffix to its canonical domain (`mobile.twitter.com` →
 * `mobile.x.com`). Rule, category and unlock domains go through the same steps,
 * so a rule on `twitter.com` acts on `x.com`.
 */

/** Alias domain → canonical domain, longest alias first so the most specific suffix wins. */
internal fun aliasTableOf(aliases: Map<String, String>): List<Pair<String, String>> =
    aliases.toList().sortedWith(compareByDescending<Pair<String, String>> { it.first.length }.thenBy { it.first })

/** Steps 5 (without validation) and 6 for an ASCII host or a rule domain. */
internal fun normaliseDomain(
    domain: String,
    aliases: List<Pair<String, String>>,
): String {
    var host = domain.lowercase()
    if (host.endsWith('.')) host = host.dropLast(1)
    if (host.startsWith("www.") || host.startsWith("m.")) host = host.substring(host.indexOf('.') + 1)
    for ((alias, canonical) in aliases) {
        if (host == alias) return canonical
        if (host.endsWith(".$alias")) return host.dropLast(alias.length) + canonical
    }
    return host
}

/** `host` equals `domain` or is one of its subdomains. */
internal fun isDomainOrSubdomain(
    host: String,
    domain: String,
): Boolean = host == domain || host.endsWith(".$domain")

internal fun domainLabelCount(domain: String): Int = domain.split('.').size
