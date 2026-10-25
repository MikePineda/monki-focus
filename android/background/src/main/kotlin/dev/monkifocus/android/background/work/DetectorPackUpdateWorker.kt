// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import dev.monkifocus.android.background.packs.StoredPackCheck
import java.time.Clock

/**
 * Placeholder of the detector pack update (plan WP 2.9): until a server and
 * a pinned signing key exist it downloads nothing (the app holds no network
 * permission) and only re-verifies the packs already stored, the way the
 * accessibility service does on every start. Daily.
 */
class DetectorPackUpdateWorker(
    context: Context,
    params: WorkerParameters,
    private val packs: StoredPackCheck,
    private val clock: Clock,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val result = runCatching { packs.run(clock.instant()) }.getOrNull() ?: return Result.success()
        return Result.success(workDataOf(OUTPUT_ACCEPTED to result.accepted, OUTPUT_REJECTED to result.rejected))
    }

    companion object {
        const val OUTPUT_ACCEPTED = "accepted"
        const val OUTPUT_REJECTED = "rejected"
    }
}
