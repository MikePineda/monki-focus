// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

/**
 * What the user typed in "Go to another site" on a blocked or gated page:
 * an http(s) address the browser opens, or words for the browser's own
 * search. Kept in memory for the one tap that opens it; [toString] never
 * shows the text.
 *
 * Only `http` and `https` are ever opened as addresses: any other scheme
 * (`javascript:`, `intent:`, `file:`, `content:`) is handed to the search
 * as plain words, so the entry can never launch anything but a web page.
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

        /** A host of dot-separated labels ending in a letters-only top-level label, optionally with a port. */
        private val HOST = Regex("^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,63}(?::[0-9]{1,5})?$")

        /** The address [text] stands for, or null when it is blank. */
        fun parse(text: String): TypedAddress? {
            val typed = text.trim()
            if (typed.isEmpty()) return null
            if (typed.any { it.isWhitespace() }) return Search(typed)
            val schemed = WEB_SCHEME.find(typed)
            if (schemed == null && ANY_SCHEME.containsMatchIn(typed) && !HOST.matches(hostPart(typed))) return Search(typed)
            val rest = if (schemed != null) typed.substring(schemed.range.last + 1) else typed
            val host = hostPart(rest)
            if (!HOST.matches(host)) return Search(typed)
            val scheme = schemed?.value?.lowercase() ?: "https://"
            val label = host.substringBefore(':').lowercase().removePrefix("www.")
            return Web(scheme + rest, label)
        }

        private fun hostPart(text: String): String = text.substringBefore('/').substringBefore('?').substringBefore('#')
    }
}
