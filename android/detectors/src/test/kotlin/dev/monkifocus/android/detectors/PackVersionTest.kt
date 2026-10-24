// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class PackVersionTest {
    @Test
    fun components_compare_numerically_not_as_text() {
        assertTrue(PackVersion.parse("2026.10.25.10") > PackVersion.parse("2026.10.25.9"))
        assertTrue(PackVersion.parse("2027.01.01.1") > PackVersion.parse("2026.12.31.999"))
        assertEquals(PackVersion.parse("2026.10.25.1"), PackVersion.parse("2026.10.25.1"))
    }

    @Test
    fun a_version_that_is_not_calver_is_refused() {
        assertThrows(IllegalArgumentException::class.java) { PackVersion.parse("1.2.3") }
    }
}
