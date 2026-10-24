// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/** The guardian may see bypass events, so they hold codes only: never a URL, a title or node text. */
class BypassEventTest {
    private fun event(
        kind: String = "accessibility_disabled",
        details: Map<String, String> = mapOf("minutes_off" to "12"),
    ) = BypassEvent("id-1", kind, "2026-10-25T09:00:00Z", "2026-10-25T09:15:00Z", details)

    @Test
    fun a_coded_event_is_accepted() {
        assertEquals("accessibility_disabled", event().kind)
    }

    @Test
    fun bypass_details_reject_urls_and_free_text() {
        assertThrows(IllegalArgumentException::class.java) { event(details = mapOf("site" to "https://example.com")) }
        assertThrows(IllegalArgumentException::class.java) { event(details = mapOf("site" to "example.com/feed")) }
        assertThrows(IllegalArgumentException::class.java) { event(details = mapOf("text" to "Watch later")) }
    }

    @Test
    fun bypass_kind_must_be_a_code() {
        assertThrows(IllegalArgumentException::class.java) { event(kind = "Accessibility disabled") }
    }

    @Test
    fun bypass_cannot_be_detected_before_it_occurred() {
        assertThrows(IllegalArgumentException::class.java) {
            BypassEvent("id-1", "clock_changed", "2026-10-25T09:15:00Z", "2026-10-25T09:00:00Z")
        }
    }
}
