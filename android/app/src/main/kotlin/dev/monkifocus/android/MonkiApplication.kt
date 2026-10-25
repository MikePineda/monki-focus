// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.app.Application
import androidx.work.Configuration
import dev.monkifocus.android.background.work.MonkiWorkerFactory
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraph
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraphProvider

/**
 * Owns the [AppGraph]. The accessibility service and the workers reach it
 * with `(applicationContext as MonkiApplication).graph`; the protection
 * module, which cannot see this class, through [ProtectionGraphProvider].
 * WorkManager is initialised on demand with [MonkiWorkerFactory] (the
 * default initializer is removed in the manifest).
 */
class MonkiApplication :
    Application(),
    ProtectionGraphProvider,
    Configuration.Provider {
    val graph: AppGraph by lazy { AppGraph(this) }

    override val protectionGraph: ProtectionGraph get() = graph.protection

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(MonkiWorkerFactory { graph.workers }).build()
}
