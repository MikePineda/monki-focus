// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class PackVersionTest {
    @Test
    fun components_compare_numerically_not_as_text() {
        assertTrue(PackVersion.parse("2026.10.25.10") > PackVersion.parse("2026.10.25.9"))
        assertTrue(PackVersion.parse("2027.01.01.1") > PackVersion.parse("2026.12.31.999"))
        assertEquals(PackVersion.parse("2026.10.25.1"), PackVersion.parse("2026.10.25.1"))
        assertEquals("2026.10.25.10", PackVersion.parse("2026.10.25.10").toString())
    }

    @Test
    fun a_version_that_is_not_calver_is_refused() {
        assertThrows(IllegalArgumentException::class.java) { PackVersion.parse("1.2.3") }
    }

    @Test
    fun the_date_must_exist_on_the_calendar() {
        listOf("2026.13.01.1", "2026.00.01.1", "2026.02.30.1", "2025.02.29.1", "2026.10.32.1", "2026.10.25.01").forEach {
            assertNull(it, PackVersion.parseOrNull(it))
        }
        assertEquals("2028.02.29.0", PackVersion.parse("2028.02.29.0").toString())
    }

    @Test
    fun a_version_more_than_two_days_ahead_of_trusted_time_is_from_the_future() {
        val policy = PackVersionPolicy(emptyMap())
        val now = Instant.parse("2026-10-25T23:59:00Z")

        assertFalse(policy.isFromTheFuture(PackVersion.parse("2026.10.27.1"), now))
        assertTrue(policy.isFromTheFuture(PackVersion.parse("2026.10.28.1"), now))
    }
}
