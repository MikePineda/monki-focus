// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.repository

import dev.monkifocus.android.core.data.analytics.EventDataJson
import dev.monkifocus.android.core.data.analytics.StoredEventPrivacy
import dev.monkifocus.android.core.data.db.ActivityWatchDao
import dev.monkifocus.android.core.data.db.AwBucketEntity
import dev.monkifocus.android.core.data.db.AwEventEntity
import dev.monkifocus.android.core.data.db.MILLIS_PER_SECOND
import dev.monkifocus.android.core.data.db.instantOfMillis
import dev.monkifocus.android.core.data.db.millisOf
import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.StoredActivityEvent
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository
import dev.monkifocus.android.core.domain.ports.SettingsRepository

/**
 * [ActivityEventRepository] over `aw_bucket` and `aw_event`. Every write goes
 * through [StoredEventPrivacy] with the user's current `storeTitles` setting,
 * read from [settings] at the time of the write.
 */
class RoomActivityEventRepository(
    private val dao: ActivityWatchDao,
    private val settings: SettingsRepository,
) : ActivityEventRepository {
    override suspend fun ensureBucket(bucket: ActivityBucket) {
        dao.insertBucket(AwBucketEntity.of(bucket))
    }

    override suspend fun buckets(): List<ActivityBucket> = dao.buckets().map { it.toDomain() }

    override suspend fun record(
        bucketId: String,
        events: List<ActivityEvent>,
    ): Int {
        if (events.isEmpty()) return 0
        val storeTitles = settings.current().storeTitles
        val rows =
            events.map { event ->
                val json = EventDataJson.encode(StoredEventPrivacy.reduce(event.data, storeTitles))
                AwEventEntity(
                    bucketId = bucketId,
                    timestampMs = millisOf(event.timestamp),
                    durationMs = event.duration * MILLIS_PER_SECOND,
                    data = json,
                    dataHash = EventDataJson.hashOf(json),
                )
            }
        return dao.record(rows)
    }

    override suspend fun between(
        bucketId: String,
        from: String,
        to: String,
    ): List<StoredActivityEvent> = dao.between(bucketId, millisOf(from), millisOf(to)).map(::toDomain)

    override suspend fun last(bucketId: String): StoredActivityEvent? = dao.last(bucketId)?.let(::toDomain)

    override suspend fun deleteBefore(before: String): Int = dao.deleteBefore(millisOf(before))

    private fun toDomain(row: AwEventEntity): StoredActivityEvent =
        StoredActivityEvent(
            id = row.id,
            bucketId = row.bucketId,
            event =
                ActivityEvent(
                    timestamp = instantOfMillis(row.timestampMs),
                    duration = (row.durationMs / MILLIS_PER_SECOND).toInt(),
                    data = EventDataJson.decode(row.data),
                ),
        )
}
