// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.Configuration
import androidx.work.ListenableWorker
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerFactory
import androidx.work.WorkerParameters
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.testing.WorkManagerTestInitHelper
import dev.monkifocus.android.background.fakes.AnalyticsTestData
import dev.monkifocus.android.background.fakes.AnalyticsTestData.MINUTE
import dev.monkifocus.android.core.domain.rules.Bedtime
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.domain.rules.Weekday
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class WorkersTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val now = Instant.ofEpochMilli(AnalyticsTestData.T0 + 30 * MINUTE)
    private val deps = FakeBackgroundDependencies(now)
    private val factory = MonkiWorkerFactory { deps }

    @Before
    fun setUp() {
        val config =
            Configuration
                .Builder()
                .setExecutor(SynchronousExecutor())
                .setWorkerFactory(factory)
                .build()
        WorkManagerTestInitHelper.initializeTestWorkManager(context, config)
    }

    private inline fun <reified W : ListenableWorker> worker(): W =
        TestListenableWorkerBuilder
            .from(context, W::class.java)
            .setWorkerFactory(factory)
            .build() as W

    @Test
    fun the_ingest_worker_copies_usage_events_into_blocks() {
        deps.source.events =
            listOf(
                AnalyticsTestData.resumed(AnalyticsTestData.T0, AnalyticsTestData.SOCIAL_APP),
                AnalyticsTestData.paused(AnalyticsTestData.T0 + 10 * MINUTE, AnalyticsTestData.SOCIAL_APP),
            )

        val result = runBlocking { worker<UsageIngestWorker>().doWork() }

        assertTrue(result is ListenableWorker.Result.Success)
        assertEquals(true, result.outputData.getBoolean(UsageIngestWorker.OUTPUT_ACCESS_GRANTED, false))
        assertEquals(600, deps.blocks.all.sumOf { it.seconds })
    }

    @Test
    fun the_ingest_worker_run_twice_adds_nothing_the_second_time() {
        deps.source.events = listOf(AnalyticsTestData.resumed(AnalyticsTestData.T0, AnalyticsTestData.SOCIAL_APP))
        runBlocking { worker<UsageIngestWorker>().doWork() }

        val again = runBlocking { worker<UsageIngestWorker>().doWork() }

        assertEquals(0, again.outputData.getInt(UsageIngestWorker.OUTPUT_NEW_EVENTS, -1))
        assertEquals(0, again.outputData.getInt(UsageIngestWorker.OUTPUT_CHANGED_BLOCKS, -1))
    }

    @Test
    fun the_ingest_worker_reports_missing_usage_access_and_still_succeeds() {
        deps.source.granted = false

        val result = runBlocking { worker<UsageIngestWorker>().doWork() }

        assertTrue(result is ListenableWorker.Result.Success)
        assertEquals(false, result.outputData.getBoolean(UsageIngestWorker.OUTPUT_ACCESS_GRANTED, true))
    }

    @Test
    fun the_bedtime_worker_warns_in_the_lead_up_and_schedules_the_next_check() {
        // T0 + 30 min is 08:30 UTC; a 09:00 UTC bedtime with a 45-minute warning is in its lead-up.
        deps.ruleset =
            Ruleset(
                schemaVersion = 1,
                revision = 1,
                updatedAt = "2026-10-01T00:00:00Z",
                timeZone = "UTC",
                rules = emptyList(),
                categories = emptyList(),
                bedtime = Bedtime(enabled = true, days = Weekday.entries, start = "09:00", end = "10:00", warnMinutesBefore = 45),
                workHours = Schedule(days = emptyList(), start = "09:00", end = "17:00"),
            )

        val result = runBlocking { worker<BedtimeWarningWorker>().doWork() }

        assertTrue(result is ListenableWorker.Result.Success)
        assertEquals(listOf(30), deps.warnings)
        val scheduled = WorkManager.getInstance(context).getWorkInfosForUniqueWork(BackgroundScheduler.BEDTIME_WARNING).get()
        assertEquals(WorkInfo.State.ENQUEUED, scheduled.single().state)
    }

    @Test
    fun the_pack_worker_only_re_verifies_stored_packs() {
        val result = runBlocking { worker<DetectorPackUpdateWorker>().doWork() }

        assertEquals(1, deps.packChecks)
        assertEquals(1, result.outputData.getInt(DetectorPackUpdateWorker.OUTPUT_ACCEPTED, -1))
        assertEquals(2, result.outputData.getInt(DetectorPackUpdateWorker.OUTPUT_REJECTED, -1))
    }

    @Test
    fun the_factory_leaves_unknown_workers_to_the_default_factory() {
        var captured: WorkerParameters? = null
        TestListenableWorkerBuilder
            .from(context, UsageIngestWorker::class.java)
            .setWorkerFactory(
                object : WorkerFactory() {
                    override fun createWorker(
                        appContext: Context,
                        workerClassName: String,
                        workerParameters: WorkerParameters,
                    ): ListenableWorker? {
                        captured = workerParameters
                        return factory.createWorker(appContext, workerClassName, workerParameters)
                    }
                },
            ).build()

        assertNull(factory.createWorker(context, "com.example.UnknownWorker", requireNotNull(captured)))
    }

    @Test
    fun opening_the_app_schedules_each_job_once() {
        val workManager = WorkManager.getInstance(context)
        val scheduler = BackgroundScheduler(workManager)

        scheduler.onAppOpen()
        scheduler.onAppOpen()

        listOf(BackgroundScheduler.INGEST_PERIODIC, BackgroundScheduler.PACKS_PERIODIC).forEach { name ->
            val infos = workManager.getWorkInfosForUniqueWork(name).get().filter { !it.state.isFinished }
            assertEquals(name, 1, infos.size)
        }
        val bedtime = workManager.getWorkInfosForUniqueWork(BackgroundScheduler.BEDTIME_WARNING).get().filter { !it.state.isFinished }
        assertTrue(bedtime.size <= 1)
    }
}
