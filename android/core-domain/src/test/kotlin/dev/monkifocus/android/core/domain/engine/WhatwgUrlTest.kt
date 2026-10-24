// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The Kotlin WHATWG parser against `new URL(text)` of Node 24 (the TypeScript
 * engine's parser): each row is `[text, hostname, pathname]` as Node printed
 * them, null for a parse failure. Hosts Node turns into IPv4 or IPv6
 * addresses fail here instead; §2 step 5 rejects both alike. User info is
 * written with `\u0040` so the text never looks like an address.
 */
class WhatwgUrlTest {
    private val node24 =
        listOf(
            listOf("https://a.com/a^b|c'd", "a.com", "/a%5Eb|c'd"),
            listOf("https://a.com/\u007f\u0001x", "a.com", "/%7F%01x"),
            listOf("https://a.com/%zz%4", "a.com", "/%zz%4"),
            listOf("https://a.com/a/b/../../..", "a.com", "/"),
            listOf("https://a.com/a/%2E%2e", "a.com", "/"),
            listOf("https://a.com/a/.%2E/b", "a.com", "/b"),
            listOf("https://a.com/a/./", "a.com", "/a/"),
            listOf("https://a.com/a/..", "a.com", "/"),
            listOf("https://a.com?x", "a.com", "/"),
            listOf("https://a.com#x", "a.com", "/"),
            listOf("https://a.com\\?x", "a.com", "/"),
            listOf(" \u0001https://a.com/x \u0002", "a.com", "/x"),
            listOf("https://a.c\tom/x\ny", "a.com", "/xy"),
            listOf("https://a.com:8080/x", "a.com", "/x"),
            listOf("https://a.com:abc/", null, null),
            listOf("https://a.com:65535/", "a.com", "/"),
            listOf("https://a.com:65536/", null, null),
            listOf("https://user:pw\u0040a.com/x", "a.com", "/x"),
            listOf("https://a\u0040b\u0040c.com/x", "c.com", "/x"),
            listOf("https://a b.com/", null, null),
            listOf("https://a%20b.com/", null, null),
            listOf("https://a<b.com/", null, null),
            listOf("https://a%25.com/", null, null),
            listOf("https://a..com/", "a..com", "/"),
            listOf("https://.a.com/", ".a.com", "/"),
            listOf("https://a.com./", "a.com.", "/"),
            listOf("https://A.COM/", "a.com", "/"),
            listOf("https://%C3%BC.de/", "xn--tda.de", "/"),
            listOf("https://ü.de/", "xn--tda.de", "/"),
            listOf("https://a.%zz/", null, null),
            listOf("https://xn--bcher-kva.example/", "xn--bcher-kva.example", "/"),
            listOf("https://bücher.example/katalog", "xn--bcher-kva.example", "/katalog"),
            listOf("https://a.0x1/", null, null),
            listOf("https://a.1/", null, null),
            listOf("https://a.b1/", "a.b1", "/"),
            listOf("https://x", "x", "/"),
            listOf("https://", null, null),
            listOf("https:///a.com", "a.com", "/"),
            listOf("https:a.com/x", "a.com", "/x"),
            listOf("http:\\\\a.com\\x", "a.com", "/x"),
            listOf("https://a.com/é😀", "a.com", "/%C3%A9%F0%9F%98%80"),
            listOf("https://a.com/a b", "a.com", "/a%20b"),
            listOf("https://a.com/[x]", "a.com", "/[x]"),
            listOf("https://a.com/x\"y", "a.com", "/x%22y"),
            listOf("https://a.com/{x}", "a.com", "/%7Bx%7D"),
            listOf("https://a.com/`x", "a.com", "/%60x"),
            listOf("https://a.com/x;y", "a.com", "/x;y"),
            listOf("https://a.com/~x", "a.com", "/~x"),
            listOf("https://ß.de/", "xn--zca.de", "/"),
            listOf("https://a。b.com/", "a.b.com", "/"),
            listOf("https://a．b.com/", "a.b.com", "/"),
            listOf("https://exa_mple.com/", "exa_mple.com", "/"),
            listOf("https://a*b.com/", "a*b.com", "/"),
            listOf("https://a!b.com/", "a!b.com", "/"),
            listOf("https://a\$b.com/", "a\$b.com", "/"),
            listOf("https://a&b.com/", "a&b.com", "/"),
            listOf("https://a(b).com/", "a(b).com", "/"),
            listOf("https://a+b.com/", "a+b.com", "/"),
            listOf("https://a,b.com/", "a,b.com", "/"),
            listOf("https://a=b.com/", "a=b.com", "/"),
            listOf("https://a~b.com/", "a~b.com", "/"),
            listOf("https://a'b.com/", "a'b.com", "/"),
            listOf("https://a\"b.com/", "a\"b.com", "/"),
            listOf("https://a`b.com/", "a`b.com", "/"),
            listOf("https://a{b}.com/", "a{b}.com", "/"),
            listOf("https://a^b.com/", null, null),
            listOf("https://a|b.com/", null, null),
            listOf("https://a\u007fb.com/", null, null),
            listOf("https://Ａ.com/", "a.com", "/"),
            listOf("https://­.com/", ".com", "/"),
            listOf("https://a​b.com/", "ab.com", "/"),
            listOf("https://a.com/\uD800", "a.com", "/%EF%BF%BD"),
            listOf("https://xn--abc.com/", "xn--abc.com", "/"),
            listOf("https://-a.com/", "-a.com", "/"),
            listOf("HTTPS://visitor!@Old.Reddit.com:443/r/x/?utm_source=share#c", "old.reddit.com", "/r/x/"),
        )

    @Test
    fun parses_hostname_and_pathname_like_node_24() {
        val mismatches =
            node24.mapNotNull { (text, hostname, pathname) ->
                val parsed = WhatwgUrl.parse(text!!)
                val actual = listOf(parsed?.hostname, parsed?.pathname)
                if (actual == listOf(hostname, pathname)) null else "$text -> $actual, Node 24: [$hostname, $pathname]"
            }

        assertEquals(emptyList<String>(), mismatches)
    }

    @Test
    fun ip_addresses_fail_like_any_host_that_is_not_a_domain() {
        assertEquals(null, WhatwgUrl.parse("https://1.2.3.4/"))
        assertEquals(null, WhatwgUrl.parse("https://[::1]/x"))
    }

    @Test
    fun punycode_matches_rfc_3492() {
        assertEquals("bcher-kva", Punycode.encode("bücher"))
        assertEquals("zca", Punycode.encode("ß"))
        assertEquals("tda", Punycode.encode("ü"))
    }
}
