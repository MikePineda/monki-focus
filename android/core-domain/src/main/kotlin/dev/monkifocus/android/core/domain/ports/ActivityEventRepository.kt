// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.ports

import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.ActivityEvent
import dev.monkifocus.android.core.domain.analytics.StoredActivityEvent

/**
 * Raw ActivityWatch-compatible events per bucket (SEMANTICS.md §10), kept
 * locally and never synced as such. Instants are UTC RFC 3339 text.
 *
 * Privacy on write, whatever the caller passes: a `title` is kept only while
 * the user's `storeTitles` setting is on (never for an incognito tab), and a
 * web `path` is cut to its first segment (`/watch/abc` → `/watch`). The query
 * and fragment are never stored.
 *
 * An event's natural key is `(bucket, timestamp, data)` after that reduction.
 * Recording one whose key is stored keeps the longer duration, so replaying
 * the same events (a re-ingest) changes nothing and a heartbeat that extends
 * an event updates it in place.
 */
interface ActivityEventRepository {
    /** Creates [bucket] unless a bucket with its id exists (the stored one is kept). */
    suspend fun ensureBucket(bucket: ActivityBucket)

    suspend fun buckets(): List<ActivityBucket>

    /**
     * Records [events] of [bucketId] atomically, by natural key as described
     * above; the bucket must exist. Answers how many events were new.
     */
    suspend fun record(
        bucketId: String,
        events: List<ActivityEvent>,
    ): Int

    /** Events of [bucketId] whose timestamp is in `[from, to)`, oldest first. */
    suspend fun between(
        bucketId: String,
        from: String,
        to: String,
    ): List<StoredActivityEvent>

    /** The latest event of [bucketId], or null. */
    suspend fun last(bucketId: String): StoredActivityEvent?

    /** Deletes every event (any bucket) with a timestamp before [before]; answers how many. */
    suspend fun deleteBefore(before: String): Int
}
