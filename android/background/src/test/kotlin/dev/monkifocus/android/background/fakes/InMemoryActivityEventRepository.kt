// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.fakes

import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.StoredActivityEvent
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.ports.ActivityEventRepository

/** The port's contract in memory: natural key `(bucket, timestamp, data)`, the longer duration wins. */
class InMemoryActivityEventRepository : ActivityEventRepository {
    private val bucketsById = LinkedHashMap<String, ActivityBucket>()
    private val rows = mutableListOf<StoredActivityEvent>()
    private var nextId = 1L

    val all: List<StoredActivityEvent> get() = rows.sortedWith(compareBy({ it.bucketId }, { epochSecondsOf(it.event.timestamp) }))

    fun events(bucketId: String): List<ActivityEvent> = all.filter { it.bucketId == bucketId }.map { it.event }

    override suspend fun ensureBucket(bucket: ActivityBucket) {
        bucketsById.putIfAbsent(bucket.id, bucket)
    }

    override suspend fun buckets(): List<ActivityBucket> = bucketsById.values.toList()

    override suspend fun record(
        bucketId: String,
        events: List<ActivityEvent>,
    ): Int {
        check(bucketId in bucketsById) { "unknown bucket" }
        var added = 0
        for (event in events) {
            val index =
                rows.indexOfFirst {
                    it.bucketId == bucketId && epochSecondsOf(it.event.timestamp) == epochSecondsOf(event.timestamp) &&
                        it.event.data == event.data
                }
            if (index < 0) {
                rows += StoredActivityEvent(nextId++, bucketId, event)
                added++
            } else if (rows[index].event.duration < event.duration) {
                rows[index] = rows[index].copy(event = event)
            }
        }
        return added
    }

    override suspend fun between(
        bucketId: String,
        from: String,
        to: String,
    ): List<StoredActivityEvent> =
        all.filter {
            it.bucketId == bucketId &&
                epochSecondsOf(it.event.timestamp) >= epochSecondsOf(from) &&
                epochSecondsOf(it.event.timestamp) < epochSecondsOf(to)
        }

    override suspend fun last(bucketId: String): StoredActivityEvent? = all.lastOrNull { it.bucketId == bucketId }

    override suspend fun deleteBefore(before: String): Int {
        val doomed = rows.filter { epochSecondsOf(it.event.timestamp) < epochSecondsOf(before) }
        rows.removeAll(doomed)
        return doomed.size
    }
}
