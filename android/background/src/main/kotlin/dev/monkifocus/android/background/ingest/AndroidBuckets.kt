// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.ingest

import dev.monkifocus.android.core.domain.analytics.ActivityBucket
import dev.monkifocus.android.core.domain.analytics.BucketType
import dev.monkifocus.android.core.domain.analytics.activityWatchBucketId

/**
 * The ActivityWatch buckets this device writes (plan §2.10): foreground apps
 * (`currentwindow`, the app is the package name), away periods (`afkstatus`)
 * and browser pages seen by the accessibility service (`web.tab.current`,
 * domain and first path segment only). The hostname is a neutral device name,
 * never the hardware model or anything personal; [created] only applies the
 * first time a bucket is stored.
 */
class AndroidBuckets(
    created: String,
    hostname: String = DEFAULT_HOSTNAME,
) {
    val window: ActivityBucket = bucket(BucketType.CURRENT_WINDOW, hostname, created)
    val afk: ActivityBucket = bucket(BucketType.AFK_STATUS, hostname, created)
    val web: ActivityBucket = bucket(BucketType.WEB_TAB_CURRENT, hostname, created)

    private fun bucket(
        type: BucketType,
        hostname: String,
        created: String,
    ) = ActivityBucket(activityWatchBucketId(type, hostname), type, CLIENT, hostname, created)

    companion object {
        const val CLIENT = "monki-focus-android"
        const val DEFAULT_HOSTNAME = "phone"
    }
}
