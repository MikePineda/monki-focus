// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.monkifocus.android.background.bedtime.BedtimeWarningRun
import kotlinx.coroutines.CancellationException
import java.time.Clock

/**
 * The bedtime warning fallback (plan §2.7): a one-time work that posts the
 * warning when it runs inside the lead-up and then schedules itself for the
 * next lead-up with an inexact initial delay. No exact alarm is used, so the
 * warning may come a few minutes late; the accessibility service warns on
 * screen events too.
 */
class BedtimeWarningWorker(
    context: Context,
    params: WorkerParameters,
    private val warning: BedtimeWarningRun,
    private val clock: Clock,
    private val scheduler: BackgroundScheduler = BackgroundScheduler(WorkManager.getInstance(context)),
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val nowSeconds = Math.floorDiv(clock.millis(), MILLIS_PER_SECOND)
        val next =
            try {
                warning.run(nowSeconds)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                nowSeconds + RETRY_SECONDS
            }
        // Last step: replacing this unique work stops this run, which is over anyway.
        scheduler.scheduleBedtimeWarning(delaySeconds = (next - nowSeconds).coerceAtLeast(MIN_DELAY_SECONDS))
        return Result.success()
    }

    private companion object {
        const val MILLIS_PER_SECOND = 1_000L
        const val RETRY_SECONDS = 3_600L

        /** Never reschedule into the same minute (a loop if the clock is off). */
        const val MIN_DELAY_SECONDS = 60L
    }
}
