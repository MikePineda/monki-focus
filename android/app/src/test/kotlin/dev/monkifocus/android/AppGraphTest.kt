// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.test.core.app.ApplicationProvider
import dev.monkifocus.android.background.work.MonkiWorkerFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.ZoneOffset

@RunWith(RobolectricTestRunner::class)
class AppGraphTest {
    @Test
    fun app_graph_builds_from_the_application() {
        val application = ApplicationProvider.getApplicationContext<MonkiApplication>()

        val graph = application.graph

        assertSame(application, graph.application)
        assertSame("the graph is a singleton per process", graph, application.graph)
        assertEquals(ZoneOffset.UTC, graph.wallClock.zone)
    }

    @Test
    fun work_manager_builds_the_workers_with_the_graph() {
        val application = ApplicationProvider.getApplicationContext<MonkiApplication>()

        assertTrue(application.workManagerConfiguration.workerFactory is MonkiWorkerFactory)
        assertSame(application.graph.usageIngest, application.graph.workers.usageIngest)
        assertSame(application.graph.wallClock, application.graph.workers.wallClock)
    }
}
