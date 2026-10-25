// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.lang.reflect.Modifier
import kotlin.random.Random

/**
 * The analytics invariants of SEMANTICS.md §10 over seeded random inputs
 * (plain JUnit: a fixed seed per run index makes every failure reproducible),
 * mirroring the TypeScript properties of `packages/analytics`.
 */
class AnalyticsPropertiesTest {
    private val runs = 300
    private val start = epochSecondsOf("2026-10-26T00:00:00Z")
    private val levels = listOf(0, 25, 50, 75, 100)
    private val activityKeys = listOf("example.org", "docs.example.org", "org.example.Editor", "example.net")
    private val categories = listOf("reference", "social", "video/short-form", "uncategorised")

    private fun forAll(check: (seed: Int, Random) -> Unit) {
        for (seed in 0 until runs) check(seed, Random(seed))
    }

    private fun Random.attributedEvent(
        timestamp: Long = start + nextLong(0, 86_401),
        duration: Int = nextInt(0, 3_601),
        title: String? = null,
        url: String? = null,
    ) = AttributedEvent(
        timestamp = utcInstantOf(timestamp),
        duration = duration,
        source = ActivitySource.entries.random(this),
        activityKey = activityKeys.random(this),
        categoryPath = categories.random(this),
        level = levels.random(this),
        title = title,
        url = url,
    )

    /** Back-to-back events separated by gaps, so no block can exceed 300 s. */
    private fun Random.sequentialEvents(): List<AttributedEvent> {
        var cursor = start
        return List(nextInt(0, 41)) {
            cursor += nextLong(0, 901)
            val duration = nextInt(0, 2_001)
            attributedEvent(timestamp = cursor, duration = duration).also { cursor += duration }
        }
    }

    private fun secondsPerStart(blocks: List<ActivityBlock>): Map<String, Int> =
        blocks.groupingBy { it.blockStart }.fold(0) { sum, block -> sum + block.seconds }

    @Test
    fun split_preserves_total_seconds() {
        forAll { seed, random ->
            val events = random.sequentialEvents()
            val blocks = toBlocks(events, BlockOptions("device-a", syncActivityKey = random.nextBoolean()))

            assertEquals("seed $seed", events.sumOf { it.duration }, blocks.sumOf { it.seconds })
        }
    }

    @Test
    fun block_never_exceeds_300_seconds() {
        forAll { seed, random ->
            val events = List(random.nextInt(0, 41)) { random.attributedEvent() }
            val blocks = toBlocks(events, BlockOptions("device-a", syncActivityKey = true))

            assertTrue("seed $seed", blocks.all { it.seconds in 1..300 })
            assertTrue("seed $seed", secondsPerStart(blocks).values.all { it <= 300 })
        }
    }

    @Test
    fun cross_device_cap_keeps_min_of_total_and_300_per_block_start() {
        forAll { seed, random ->
            val blocks =
                List(random.nextInt(0, 5)) {
                    val deviceId = listOf("device-a", "device-b", "device-c").random(random)
                    toBlocks(List(random.nextInt(0, 11)) { random.attributedEvent() }, BlockOptions(deviceId, syncActivityKey = true))
                }.flatten()
            val before = secondsPerStart(blocks)
            val after = secondsPerStart(capAcrossDevices(blocks))

            assertEquals("seed $seed", before.mapValues { (_, seconds) -> minOf(seconds, 300) }, after)
        }
    }

    @Test
    fun pulse_is_between_0_and_100_or_null() {
        forAll { seed, random ->
            val entries = List(random.nextInt(0, 501)) { PulseInput(random.nextLong(0, 31_622_401), levels.random(random)) }
            val value = pulse(entries)

            if (entries.sumOf { it.seconds } == 0L) {
                assertNull("seed $seed", value)
            } else {
                assertTrue("seed $seed: $value", value != null && value in 0..100)
            }
        }
    }

    @Test
    fun pulse_is_null_when_every_entry_has_zero_seconds() {
        assertNull(pulse(List(5) { PulseInput(0, levels[it]) }))
    }

    @Test
    fun synced_blocks_never_contain_titles_or_urls() {
        forAll { seed, random ->
            val events =
                List(random.nextInt(0, 21)) {
                    // Every title carries U+0001 and every URL U+0002: neither may reach a block.
                    val title = "\u0001" + List(random.nextInt(1, 41)) { random.nextInt(32, 127).toChar() }.joinToString("")
                    val url = "https://${activityKeys.random(random)}/path?q=${random.nextInt()}#\u0002"
                    random.attributedEvent(title = title, url = url)
                }
            val blocks = toBlocks(events, BlockOptions("device-a", syncActivityKey = random.nextBoolean()))

            for (block in blocks) {
                val text = "$block"
                assertFalse("seed $seed", '\u0001' in text || '\u0002' in text || "://" in text)
                assertTrue("seed $seed", block.activityKey == null || block.activityKey in activityKeys)
            }
        }
    }

    @Test
    fun a_synced_block_has_exactly_the_seven_sync_fields() {
        val fields =
            ActivityBlock::class.java.declaredFields
                .filterNot { Modifier.isStatic(it.modifiers) }
                .map { it.name }

        assertEquals(SYNC_BLOCK_FIELDS.sorted(), fields.sorted())
    }

    @Test
    fun generated_events_reach_the_cap() {
        // Guards the generators: a cap property over blocks that never overlap would prove nothing.
        val capped =
            (0 until runs).count { seed ->
                val random = Random(seed)
                val events = List(random.nextInt(0, 41)) { random.attributedEvent() }
                val sums = mutableMapOf<String, Long>()
                for (event in events) {
                    var cursor = epochSecondsOf(event.timestamp)
                    val end = cursor + event.duration
                    while (cursor < end) {
                        val blockStart = Math.floorDiv(cursor, 300L) * 300
                        val pieceEnd = minOf(blockStart + 300, end)
                        sums.merge(utcInstantOf(blockStart), pieceEnd - cursor, Long::plus)
                        cursor = pieceEnd
                    }
                }
                sums.values.any { it > 300 }
            }

        assertTrue("$capped of $runs runs exceed the cap", capped > runs / 4)
    }
}
