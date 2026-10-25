// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Every background job, as unique work so nothing is ever enqueued twice.
 * No constraint needs the network (the app has no network permission) and
 * none waits for charging: analytics must keep up with the system's own
 * few-day retention of usage events. Nothing uses an exact alarm.
 */
class BackgroundScheduler(
    private val workManager: WorkManager,
) {
    /** When the app opens: keep the periodic jobs, ingest now and re-plan the bedtime warning (rules may have changed). */
    fun onAppOpen() {
        schedulePeriodic()
        workManager.enqueueUniqueWork(INGEST_NOW, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<UsageIngestWorker>().build())
        scheduleBedtimeWarning(delaySeconds = 0, policy = ExistingWorkPolicy.REPLACE)
    }

    /** The periodic jobs, kept when they already exist. */
    fun schedulePeriodic() {
        workManager.enqueueUniquePeriodicWork(
            INGEST_PERIODIC,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<UsageIngestWorker>(INGEST_PERIOD_MINUTES, TimeUnit.MINUTES).build(),
        )
        workManager.enqueueUniquePeriodicWork(
            PACKS_PERIODIC,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<DetectorPackUpdateWorker>(PACKS_PERIOD_HOURS, TimeUnit.HOURS).build(),
        )
    }

    /** The next bedtime warning check, in [delaySeconds] (inexact). */
    fun scheduleBedtimeWarning(
        delaySeconds: Long,
        policy: ExistingWorkPolicy = ExistingWorkPolicy.REPLACE,
    ) {
        val request =
            OneTimeWorkRequestBuilder<BedtimeWarningWorker>()
                .setInitialDelay(delaySeconds.coerceAtLeast(0), TimeUnit.SECONDS)
                .build()
        workManager.enqueueUniqueWork(BEDTIME_WARNING, policy, request)
    }

    companion object {
        const val INGEST_PERIODIC = "usage-ingest"
        const val INGEST_NOW = "usage-ingest-now"
        const val BEDTIME_WARNING = "bedtime-warning"
        const val PACKS_PERIODIC = "detector-pack-update"

        /** WorkManager's minimum period. */
        const val INGEST_PERIOD_MINUTES = 15L
        const val PACKS_PERIOD_HOURS = 24L
    }
}
