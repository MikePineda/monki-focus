// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dev.monkifocus.android.background.ingest.UsageIngest
import kotlinx.coroutines.CancellationException
import java.time.Clock

/**
 * Copies the system usage events into the local analytics store and
 * refreshes the 5-minute blocks ([UsageIngest]). Periodic (15 minutes, the
 * WorkManager minimum) and once when the app opens. A failure is retried with
 * WorkManager's backoff; the run is idempotent. The output holds counts only.
 */
class UsageIngestWorker(
    context: Context,
    params: WorkerParameters,
    private val ingest: UsageIngest,
    private val clock: Clock,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result =
        try {
            val result = ingest.run(clock.millis())
            Result.success(
                workDataOf(
                    OUTPUT_ACCESS_GRANTED to result.accessGranted,
                    OUTPUT_NEW_EVENTS to result.newEvents,
                    OUTPUT_CHANGED_BLOCKS to result.changedBlocks,
                ),
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            Result.retry()
        }

    companion object {
        const val OUTPUT_ACCESS_GRANTED = "accessGranted"
        const val OUTPUT_NEW_EVENTS = "newEvents"
        const val OUTPUT_CHANGED_BLOCKS = "changedBlocks"
    }
}
