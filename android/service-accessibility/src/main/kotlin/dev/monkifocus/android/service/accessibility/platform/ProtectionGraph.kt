// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Context
import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder
import dev.monkifocus.android.service.accessibility.exit.ExitFlowController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import java.util.UUID

/**
 * The protection's part of the composition root, one per process (held by
 * `AppGraph`): what the service, `GateActivity`, the app's exit screen, the
 * device-admin receiver and the notice receiver share. Writes to Room go
 * through [io], one at a time, so they land in the order they were made.
 */
class ProtectionGraph(
    context: Context,
    val inputs: ProtectionInputs,
) {
    private val appContext: Context = context.applicationContext

    @OptIn(ExperimentalCoroutinesApi::class)
    val io: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO.limitedParallelism(1))

    val preferences: ProtectionPreferences by lazy { ProtectionPreferences(appContext) }

    val bypassSink: JournalledBypassSink by lazy { JournalledBypassSink(preferences, inputs.bypassOutbox, io) }

    val bypasses: BypassRecorder by lazy { BypassRecorder(bypassSink) { UUID.randomUUID().toString() } }

    val exitFlow: ExitFlowController by lazy {
        ExitFlowController(
            preferences,
            bypasses,
            DeviceAdminDisarmer(appContext, inputs.deviceAdmin, inputs.notifier, preferences),
            AndroidExitClock(appContext),
        )
    }

    val gateRelay: GateRelay by lazy { GateRelay() }

    /** "Turn on protection" in our app, after the notification step: the service may now act. */
    fun armByUser() {
        preferences.armedByUser = true
    }

    /** Whether a guardian is linked, as the running service last read it (the notice names them only then). */
    @Volatile
    var guardianLinked: Boolean = false
}
