// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.support

import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.service.accessibility.action.ActionPerformer
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.exit.ExitFlowStore
import dev.monkifocus.android.service.accessibility.exit.ProtectionDisarmer
import dev.monkifocus.android.service.accessibility.gate.IntentionLog

/** Records what the pipeline asked the device to do, in order. */
internal class RecordingPerformer : ActionPerformer {
    sealed interface Call {
        data object Back : Call

        data object Home : Call

        data class Show(
            val content: OverlayContent,
        ) : Call

        data object Clear : Call
    }

    val calls = mutableListOf<Call>()

    /** Whether our host is in front; showing puts it there, a test takes it away (the user left with HOME). */
    var onTop = false

    override fun isOnTop(): Boolean = onTop

    override fun back() {
        calls += Call.Back
    }

    override fun home() {
        calls += Call.Home
    }

    override fun show(content: OverlayContent) {
        calls += Call.Show(content)
        onTop = true
    }

    override fun clear() {
        calls += Call.Clear
        onTop = false
    }

    fun take(): List<Call> = calls.toList().also { calls.clear() }
}

internal class RecordingIntentionLog : IntentionLog {
    val entries = mutableListOf<String>()

    override fun started(
        group: String,
        minutes: Int,
        typedWords: Int,
        startedAt: String,
        endsAt: String,
    ) {
        entries += "started:$group:$minutes:$typedWords"
    }

    override fun ended(
        group: String,
        outcome: IntentionOutcome,
        at: String,
    ) {
        entries += "ended:$group:${outcome.code}"
    }
}

internal class MemoryExitFlowStore(
    var stored: ExitFlowState = ExitFlowState.Armed,
) : ExitFlowStore {
    override fun load(): ExitFlowState = stored

    override fun save(state: ExitFlowState) {
        stored = state
    }
}

internal class RecordingDisarmer(
    private val log: MutableList<String> = mutableListOf(),
) : ProtectionDisarmer {
    val calls: List<String> get() = log

    override fun disarmDeviceAdmin() {
        log += "disarm_device_admin"
    }

    override fun stopProtection() {
        log += "stop_protection"
    }
}
