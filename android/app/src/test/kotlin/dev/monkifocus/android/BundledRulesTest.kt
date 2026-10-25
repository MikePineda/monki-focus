// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.service.accessibility.packs.ActivePacks
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

/** The rules data copied into the APK's assets, read through the app graph the service uses. */
@RunWith(RobolectricTestRunner::class)
class BundledRulesTest {
    private val graph = ApplicationProvider.getApplicationContext<MonkiApplication>().graph

    @Test
    fun every_bundled_detector_pack_loads_through_the_protection_inputs() {
        val inputs = graph.protection.inputs

        val packs = ActivePacks(inputs.packLoader).load(inputs.bundledPacks(), emptyMap(), Instant.now())

        assertEquals(listOf("browsers", "instagram", "settings", "youtube"), packs.map { it.packId })
    }

    @Test
    fun the_starter_preset_is_valid_and_pinned_to_a_time_zone() {
        val starter = graph.rules.starter

        assertTrue(starter.rules.isNotEmpty())
        assertTrue(starter.timeZone.isNotEmpty())
    }

    @Test
    fun the_catalog_knows_the_site_profiles() {
        assertTrue(graph.rules.catalog.profileForHost("reddit.com") != null)
    }

    @Test
    fun the_guard_looks_for_our_own_label() {
        assertEquals(setOf("monki-focus"), graph.protection.inputs.ownLabels)
    }
}
