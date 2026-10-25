// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import android.content.Context
import androidx.work.ListenableWorker
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters

/**
 * Builds the workers with their dependencies from the composition root
 * (constructor injection, no reflection). [dependencies] is read lazily so the
 * graph is only built when a worker actually runs. Unknown class names answer
 * null (WorkManager then falls back to its default factory).
 */
class MonkiWorkerFactory(
    private val dependencies: () -> BackgroundDependencies,
) : WorkerFactory() {
    override fun createWorker(
        appContext: Context,
        workerClassName: String,
        workerParameters: WorkerParameters,
    ): ListenableWorker? =
        when (workerClassName) {
            UsageIngestWorker::class.java.name -> {
                val deps = dependencies()
                UsageIngestWorker(appContext, workerParameters, deps.usageIngest, deps.wallClock)
            }

            BedtimeWarningWorker::class.java.name -> {
                val deps = dependencies()
                BedtimeWarningWorker(appContext, workerParameters, deps.bedtimeWarning, deps.wallClock)
            }

            DetectorPackUpdateWorker::class.java.name -> {
                val deps = dependencies()
                DetectorPackUpdateWorker(appContext, workerParameters, deps.storedPacks, deps.wallClock)
            }

            else -> {
                null
            }
        }
}
