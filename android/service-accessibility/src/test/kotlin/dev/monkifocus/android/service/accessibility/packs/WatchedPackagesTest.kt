// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.packs

import dev.monkifocus.android.service.accessibility.support.CHROME
import dev.monkifocus.android.service.accessibility.support.OURS
import dev.monkifocus.android.service.accessibility.support.RulesData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WatchedPackagesTest {
    private val configured = listOf(CHROME, "com.android.settings")

    @Test
    fun every_browser_on_the_device_is_watched() {
        val watched = WatchedPackages.of(configured, listOf(CHROME, "org.example.browser"), OURS, RulesData.packs)

        assertTrue("org.example.browser" in watched.all)
        assertTrue(configured.all { it in watched.all })
    }

    @Test
    fun only_browsers_no_pack_can_read_are_unsupported() {
        val watched = WatchedPackages.of(configured, listOf(CHROME, "org.example.browser", OURS), OURS, RulesData.packs)

        assertEquals(setOf("org.example.browser"), watched.unsupported)
    }

    @Test
    fun a_browser_installed_later_is_watched_on_the_next_resolution_and_a_removed_one_dropped() {
        val before = WatchedPackages.of(configured, listOf(CHROME), OURS, RulesData.packs)
        val installed = WatchedPackages.of(configured, listOf(CHROME, "org.example.browser"), OURS, RulesData.packs)
        val removed = WatchedPackages.of(configured, listOf(CHROME), OURS, RulesData.packs)

        assertTrue("org.example.browser" !in before.all)
        assertTrue("org.example.browser" in installed.unsupported)
        assertEquals(before, removed)
    }
}
