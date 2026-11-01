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
