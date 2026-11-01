// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.action

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** What the user types in "Go to another site": a web address, or words for the browser's search. */
class TypedAddressTest {
    @Test
    fun a_bare_domain_opens_over_https() {
        assertEquals(TypedAddress.Web("https://weather.example", "weather.example"), TypedAddress.parse(" weather.example "))
    }

    @Test
    fun a_domain_with_a_path_keeps_the_path() {
        assertEquals(
            TypedAddress.Web("https://example.org/forecast?day=1", "example.org"),
            TypedAddress.parse("example.org/forecast?day=1"),
        )
    }

    @Test
    fun an_http_or_https_address_is_kept_as_typed() {
        assertEquals(TypedAddress.Web("http://example.org/a", "example.org"), TypedAddress.parse("http://example.org/a"))
        assertEquals(TypedAddress.Web("https://www.example.org", "example.org"), TypedAddress.parse("HTTPS://www.example.org"))
    }

    @Test
    fun plain_words_become_a_search() {
        assertEquals(TypedAddress.Search("weather today"), TypedAddress.parse("weather today"))
        assertEquals(TypedAddress.Search("weather"), TypedAddress.parse("weather"))
        assertEquals(TypedAddress.Search("3.5 inches"), TypedAddress.parse("3.5 inches"))
    }

    @Test
    fun a_non_web_scheme_is_never_opened_as_an_address() {
        assertEquals(TypedAddress.Search("javascript:alert(1)"), TypedAddress.parse("javascript:alert(1)"))
        assertEquals(TypedAddress.Search("intent://x#Intent;end"), TypedAddress.parse("intent://x#Intent;end"))
        assertEquals(TypedAddress.Search("file:///sdcard/a.html"), TypedAddress.parse("file:///sdcard/a.html"))
    }

    @Test
    fun other_schemes_that_look_like_a_host_and_port_are_still_searched() {
        listOf("view-source:https://example.org", "view-source:example.org", "data:text/html,hello", "content://media.example/1")
            .forEach { typed -> assertEquals(typed, TypedAddress.Search(typed), TypedAddress.parse(typed)) }
    }

    @Test
    fun an_address_with_credentials_is_searched_never_opened() {
        assertEquals(TypedAddress.Search("user@example.org"), TypedAddress.parse("user@example.org"))
        assertEquals(TypedAddress.Search("https://user:pw@example.org"), TypedAddress.parse("https://user:pw@example.org"))
    }

    @Test
    fun an_ipv4_literal_opens_with_its_port() {
        assertEquals(TypedAddress.Web("https://192.168.1.1", "192.168.1.1"), TypedAddress.parse("192.168.1.1"))
        assertEquals(TypedAddress.Web("http://10.0.0.1:8080/admin", "10.0.0.1"), TypedAddress.parse("http://10.0.0.1:8080/admin"))
        assertEquals(TypedAddress.Search("999.1.1.1"), TypedAddress.parse("999.1.1.1"))
    }

    @Test
    fun a_port_is_kept_and_a_bad_port_is_searched() {
        assertEquals(TypedAddress.Web("https://example.org:8443/a", "example.org"), TypedAddress.parse("example.org:8443/a"))
        assertEquals(TypedAddress.Search("example.org:abc"), TypedAddress.parse("example.org:abc"))
    }

    @Test
    fun the_host_is_normalised_before_the_engine_sees_it() {
        assertEquals(TypedAddress.Web("https://example.com", "example.com"), TypedAddress.parse("example.com."))
        assertEquals(TypedAddress.Web("https://www.example.com/Path", "example.com"), TypedAddress.parse("HTTPS://WWW.EXAMPLE.COM/Path"))
        assertEquals(TypedAddress.Search("a..example.com"), TypedAddress.parse("a..example.com"))
    }

    @Test
    fun an_international_domain_becomes_punycode() {
        assertEquals(TypedAddress.Web("https://xn--bcher-kva.example", "xn--bcher-kva.example"), TypedAddress.parse("bücher.example"))
        assertEquals(
            TypedAddress.Web("https://xn--bcher-kva.example", "xn--bcher-kva.example"),
            TypedAddress.parse("xn--bcher-kva.example"),
        )
        assertEquals(TypedAddress.Web("https://example.xn--p1ai", "example.xn--p1ai"), TypedAddress.parse("example.рф"))
    }

    @Test
    fun a_blank_entry_opens_nothing() {
        assertNull(TypedAddress.parse(""))
        assertNull(TypedAddress.parse("   "))
    }

    @Test
    fun the_typed_text_never_reaches_to_string() {
        assertEquals("Search(⟨query⟩)", TypedAddress.Search("a private question").toString())
        assertEquals("Web(⟨address⟩)", TypedAddress.Web("https://example.org/private", "example.org").toString())
    }
}
