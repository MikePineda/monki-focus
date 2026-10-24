// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import dev.monkifocus.android.core.domain.rules.NormalizedUrl
import dev.monkifocus.android.core.domain.rules.RejectedUrl
import dev.monkifocus.android.core.domain.rules.UrlNormalization
import dev.monkifocus.android.core.domain.rules.UrlRejection

/*
 * `normalizeUrl(urlText, catalog)` (SEMANTICS.md §2): raw URL text, as a tab
 * or a mobile URL bar shows it, to `{host, path, pathKnown, surface}` or a
 * rejection. Parsing follows WHATWG URL semantics (`WhatwgUrl.kt`).
 */

private val SCHEME = Regex("^([A-Za-z][A-Za-z0-9+.-]*):")
private val ESCAPE = Regex("%([0-9A-Fa-f]{2})")
private val TOP_LEVEL_LABEL = Regex("^(?:[a-z]+|xn--[a-z0-9-]+)$")

/** White space as ECMAScript's `String.prototype.trim` defines it (not Kotlin's `trim()`). */
private fun isEcmaScriptWhiteSpace(c: Char): Boolean =
    c == '\t' ||
        c == '\n' ||
        c == '\u000B' ||
        c == '\u000C' ||
        c == '\r' ||
        c == ' ' ||
        c == ' ' ||
        c == ' ' ||
        c in ' '..' ' ||
        c == ' ' ||
        c == ' ' ||
        c == ' ' ||
        c == ' ' ||
        c == '　' ||
        c == '﻿'

private fun isUnreserved(c: Char): Boolean = c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c in "-._~"

private fun normaliseSegment(segment: String): String =
    ESCAPE.replace(segment) { escape ->
        val hex = escape.groupValues[1]
        val character = hex.toInt(16).toChar()
        if (isUnreserved(character)) character.toString() else "%" + hex.uppercase()
    }

/** A segment that could disguise the real path makes the path unknown (step 7). */
private fun isAmbiguousSegment(segment: String): Boolean = "%2F" in segment || segment == "." || segment == ".." || ';' in segment

private fun normaliseHost(
    hostname: String,
    catalog: RulesCatalog,
): String? {
    val host = catalog.normaliseDomain(hostname)
    val labels = host.split('.')
    if (labels.size < 2 || labels.any { it.isEmpty() }) return null
    return if (TOP_LEVEL_LABEL.matches(labels.last())) host else null
}

/** The most specific surface glob of the host's profile that matches the path (step 8). */
internal fun resolveSurface(
    host: String,
    path: String,
    catalog: RulesCatalog,
): String? {
    val profile = catalog.profileForHost(host) ?: return null
    var best: Triple<String, Int, Int>? = null
    for ((surface, globs) in profile.surfaces) {
        for (glob in globs.filter { matchesGlob(it, path) }) {
            val (literals, wildcards) = globShape(glob)
            val better =
                best == null ||
                    literals > best.second ||
                    (literals == best.second && wildcards < best.third)
            if (better) best = Triple(surface, literals, wildcards)
        }
    }
    return best?.first
}

fun normalizeUrl(
    urlText: String,
    catalog: RulesCatalog,
): UrlNormalization {
    val text = urlText.trim(::isEcmaScriptWhiteSpace)
    val scheme = SCHEME.find(text)?.groupValues?.get(1)
    val hasScheme = scheme != null && '.' !in scheme
    if (hasScheme && scheme.lowercase() != "http" && scheme.lowercase() != "https") {
        return RejectedUrl(UrlRejection.NOT_HTTP)
    }
    var pathKnown = hasScheme || text.any { it == '/' || it == '?' || it == '#' }
    val url = WhatwgUrl.parse(if (hasScheme) text else "https://$text")
    val host = url?.let { normaliseHost(it.hostname, catalog) }
    if (url == null || host == null) return RejectedUrl(UrlRejection.INVALID_HOST)
    val segments =
        url.pathname
            .split('/')
            .filter { it.isNotEmpty() }
            .map(::normaliseSegment)
    if (segments.any(::isAmbiguousSegment)) pathKnown = false
    val path = "/" + segments.joinToString("/")
    return NormalizedUrl(host, path, pathKnown, if (pathKnown) resolveSurface(host, path, catalog) else null)
}
