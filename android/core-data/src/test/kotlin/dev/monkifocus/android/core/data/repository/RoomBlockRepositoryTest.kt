// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.db.MonkiDatabase
import dev.monkifocus.android.core.data.db.inMemoryDatabase
import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RoomBlockRepositoryTest {
    private lateinit var db: MonkiDatabase
    private lateinit var repository: RoomBlockRepository

    private fun block(
        blockStart: String = "2026-10-25T09:00:00Z",
        activityKey: String? = "example.com",
        source: ActivitySource = ActivitySource.WEB,
        level: Int = 0,
        seconds: Int = 120,
        deviceId: String = "device-1",
    ) = ActivityBlock(deviceId, blockStart, activityKey, "news", level, source, seconds)

    private val day = "2026-10-25T00:00:00Z" to "2026-10-26T00:00:00Z"

    @Before
    fun open() {
        db = inMemoryDatabase()
        repository = RoomBlockRepository(db.activityBlocks())
    }

    @After
    fun close() = db.close()

    @Test
    fun block_upsert_is_idempotent() =
        runTest {
            val blocks = listOf(block(), block(blockStart = "2026-10-25T09:05:00Z", seconds = 300))

            repository.upsert(blocks)
            repository.upsert(blocks)

            assertEquals(blocks, repository.between(day.first, day.second))
        }

    @Test
    fun upsert_replaces_seconds_by_natural_key() =
        runTest {
            repository.upsert(listOf(block(seconds = 120)))
            repository.upsert(listOf(block(seconds = 180)))

            assertEquals(listOf(block(seconds = 180)), repository.between(day.first, day.second))
        }

    @Test
    fun a_null_activity_key_is_its_own_key_and_sorts_first() =
        runTest {
            repository.upsert(listOf(block(activityKey = "example.com"), block(activityKey = null)))
            repository.upsert(listOf(block(activityKey = null, seconds = 60)))

            assertEquals(listOf(block(activityKey = null, seconds = 60), block()), repository.between(day.first, day.second))
        }

    @Test
    fun between_uses_the_canonical_order() =
        runTest {
            val later = block(blockStart = "2026-10-25T09:05:00Z")
            val app = block(source = ActivitySource.APP, activityKey = "com.example.app")
            val androidHigher = block(source = ActivitySource.ANDROID, activityKey = "com.example.app", level = 25)
            val android = block(source = ActivitySource.ANDROID, activityKey = "com.example.app")
            val otherDevice = block(deviceId = "device-0")

            repository.upsert(listOf(later, app, androidHigher, android, otherDevice))

            // blockStart, deviceId, activityKey, categoryPath, source ("android" < "app"), level.
            assertEquals(listOf(otherDevice, android, androidHigher, app, later), repository.between(day.first, day.second))
        }

    @Test
    fun replace_range_answers_changes_and_drops_stale_blocks() =
        runTest {
            repository.upsert(listOf(block(seconds = 120), block(activityKey = "example.org"), block(deviceId = "device-2")))

            val changed =
                repository.replaceRange(
                    "device-1",
                    "2026-10-25T09:00:00Z",
                    "2026-10-25T09:05:00Z",
                    listOf(block(seconds = 120), block(activityKey = "example.net", seconds = 30)),
                )

            assertEquals(listOf(block(activityKey = "example.net", seconds = 30)), changed)
            assertEquals(
                setOf(block(seconds = 120), block(activityKey = "example.net", seconds = 30), block(deviceId = "device-2")),
                repository.between(day.first, day.second).toSet(),
            )
        }
}
