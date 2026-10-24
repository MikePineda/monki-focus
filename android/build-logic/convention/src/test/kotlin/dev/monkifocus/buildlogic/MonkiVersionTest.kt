// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.buildlogic

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MonkiVersionTest {
    @Test
    fun release_please_annotation_is_not_part_of_the_version_name() {
        val version = MonkiVersion.fromGradleProperty("1.2.3 # x-release-please-version")

        assertEquals("1.2.3", version.name)
    }

    @Test
    fun version_code_is_major_millions_plus_minor_thousands_plus_patch() {
        assertEquals(1_002_003, MonkiVersion.fromGradleProperty("1.2.3").code)
        assertEquals(10_999, MonkiVersion.fromGradleProperty("0.10.999").code)
    }

    @Test
    fun unreleased_0_0_0_gets_version_code_1_because_android_rejects_0() {
        assertEquals(1, MonkiVersion.fromGradleProperty("0.0.0 # x-release-please-version").code)
    }

    @Test
    fun later_releases_always_get_a_larger_version_code() {
        val ordered =
            listOf("0.0.1", "0.1.0", "0.999.999", "1.0.0", "1.0.1", "2.0.0")
                .map { MonkiVersion.fromGradleProperty(it).code }

        assertEquals(ordered.sorted(), ordered)
        assertEquals(ordered.size, ordered.toSet().size)
    }

    @Test
    fun minor_or_patch_above_999_is_rejected_because_codes_would_collide() {
        assertThrows(IllegalArgumentException::class.java) { MonkiVersion.fromGradleProperty("0.1000.0") }
        assertThrows(IllegalArgumentException::class.java) { MonkiVersion.fromGradleProperty("0.0.1000") }
    }

    @Test
    fun anything_but_plain_semver_fails_loudly() {
        listOf("", "1.2", "1.2.3-beta.1", "v1.2.3", "1.2.x").forEach { raw ->
            assertThrows(raw, IllegalArgumentException::class.java) { MonkiVersion.fromGradleProperty(raw) }
        }
    }
}
