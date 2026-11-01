// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import java.net.IDN

/**
 * What the user typed in "Go to another site" on a blocked or gated page:
 * an http(s) address the browser opens, or words for the browser's own
 * search. Kept in memory for the one tap that opens it; [toString] never
 * shows the text.
 *
 * Only `http` and `https` are ever opened as addresses: any other scheme
 * (`javascript:`, `intent:`, `file:`, `content:`, `data:`, `view-source:`)
 * is handed to the search as plain words, so the entry can never launch
 * anything but a web page. The host is normalised before the engine sees
 * it (lower case, punycode, no trailing dot), so `HTTPS://WWW.EXAMPLE.COM.`
 * is decided as `example.com`; an address with credentials (`user@host`)
 * is searched, never opened.
 */
sealed interface TypedAddress {
    /** An http(s) [url] whose host, without `www.`, is [label] (the block screen's title when it is blocked too). */
    class Web(
        val url: String,
        val label: String,
    ) : TypedAddress {
        override fun equals(other: Any?): Boolean = other is Web && other.url == url && other.label == label

        override fun hashCode(): Int = url.hashCode() * 31 + label.hashCode()

        override fun toString(): String = "Web(⟨address⟩)"
    }

    /** Words the browser searches with its default engine. */
    class Search(
        val query: String,
    ) : TypedAddress {
        override fun equals(other: Any?): Boolean = other is Search && other.query == query

        override fun hashCode(): Int = query.hashCode()

        override fun toString(): String = "Search(⟨query⟩)"
    }

    companion object {
        private val WEB_SCHEME = Regex("^https?://", RegexOption.IGNORE_CASE)
        private val ANY_SCHEME = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*:")

        /** Dot-separated ASCII labels ending in a letters-only or punycode top-level label. */
        private val DOMAIN =
            Regex("^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$")
        private val IPV4 = Regex("^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$")
        private val PORT = Regex("^[0-9]{1,5}$")

        /** The address [text] stands for, or null when it is blank. */
        fun parse(text: String): TypedAddress? {
            val typed = text.trim()
            if (typed.isEmpty()) return null
            if (typed.any { it.isWhitespace() }) return Search(typed)
            val schemed = WEB_SCHEME.find(typed)
            val rest = if (schemed != null) typed.substring(schemed.range.last + 1) else typed
            val authority = rest.substringBefore('/').substringBefore('?').substringBefore('#')
            val host = hostOf(authority) ?: return Search(typed)
            // Without http(s), a "scheme:" prefix that is not a host and port (view-source:, data:) is never an address.
            if (schemed == null && ANY_SCHEME.containsMatchIn(typed) && !authority.contains('.')) return Search(typed)
            val port = authority.substringAfter(':', "").let { if (it.isEmpty()) "" else ":$it" }
            val scheme = schemed?.value?.lowercase() ?: "https://"
            return Web(scheme + host + port + rest.substring(authority.length), host.removePrefix("www."))
        }

        /** The normalised host of [authority] (`host[:port]`), or null when it is not a domain or an IPv4 literal. */
        private fun hostOf(authority: String): String? {
            if ('@' in authority) return null
            val raw = authority.substringBefore(':')
            val port = authority.substringAfter(':', "")
            if (port.isNotEmpty() && !PORT.matches(port)) return null
            val trimmed = raw.trimEnd('.')
            if (trimmed.isEmpty() || trimmed.contains("..")) return null
            if (IPV4.matches(trimmed)) return trimmed
            val ascii = runCatching { IDN.toASCII(trimmed, IDN.ALLOW_UNASSIGNED).lowercase() }.getOrNull() ?: return null
            return ascii.takeIf { DOMAIN.matches(it) }
        }
    }
}
