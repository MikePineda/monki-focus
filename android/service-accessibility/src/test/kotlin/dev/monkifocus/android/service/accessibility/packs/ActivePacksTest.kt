// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.packs

import dev.monkifocus.android.service.accessibility.support.RulesData
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class ActivePacksTest {
    private val now = Instant.parse("2026-11-01T00:00:00Z")
    private val bundled = RulesData.packIds.associateWith(RulesData::packBytes)

    @Test
    fun every_bundled_pack_loads() {
        assertEquals(RulesData.packIds, ActivePacks(RulesData.loader).load(bundled, emptyMap(), now).map { it.packId })
    }

    @Test
    fun a_downloaded_pack_without_a_valid_signature_leaves_the_bundled_pack_active() {
        val tampered = String(RulesData.packBytes("instagram")).replace("2026.10.25.2", "2026.10.30.1").toByteArray()

        val packs = ActivePacks(RulesData.loader).load(bundled, mapOf("instagram" to ActivePacks.Downloaded(tampered, ByteArray(64))), now)

        assertEquals("2026.10.25.2", packs.first { it.packId == "instagram" }.packVersion)
    }

    @Test
    fun a_bundled_pack_that_fails_its_checks_is_left_out() {
        val packs = ActivePacks(RulesData.loader).load(bundled + ("youtube" to "{}".toByteArray()), emptyMap(), now)

        assertEquals(listOf("browsers", "instagram", "settings"), packs.map { it.packId })
    }
}
