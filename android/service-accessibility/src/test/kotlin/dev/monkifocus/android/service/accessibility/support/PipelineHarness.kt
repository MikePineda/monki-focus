// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.support

import dev.monkifocus.android.core.domain.ports.BypassEvent
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder
import dev.monkifocus.android.service.accessibility.decision.DecisionEvaluator
import dev.monkifocus.android.service.accessibility.decision.SnapshotHolder
import dev.monkifocus.android.service.accessibility.exit.ExitFlowController
import dev.monkifocus.android.service.accessibility.exit.ExitTime
import dev.monkifocus.android.service.accessibility.gate.GateCoordinator
import dev.monkifocus.android.service.accessibility.guard.AntiBypassGuard
import dev.monkifocus.android.service.accessibility.pipeline.EventPipeline
import dev.monkifocus.android.service.accessibility.pipeline.ScreenObserver
import dev.monkifocus.android.service.accessibility.pipeline.UserAction
import dev.monkifocus.android.service.accessibility.pipeline.WindowEvent
import dev.monkifocus.android.service.accessibility.pipeline.WindowEventType

/**
 * A whole [EventPipeline] with the real engine, packs and dumps and
 * recording fakes for every port. Both clocks advance together.
 */
internal class PipelineHarness(
    ruleset: Ruleset? = aRuleset(),
    loadFailed: Boolean = false,
    var labelCollision: Boolean = false,
    startWallMs: Long = MORNING_MS,
    unsupportedBrowsers: Set<String> = emptySet(),
) {
    val performer = RecordingPerformer()
    val escalationWrites = mutableListOf<EscalationState>()
    val bypassEvents = mutableListOf<BypassEvent>()
    val intentions = RecordingIntentionLog()
    val exitStore = MemoryExitFlowStore()
    val disarmer = RecordingDisarmer()
    var collisionChecks = 0
        private set

    val snapshots =
        SnapshotHolder().also { holder ->
            if (ruleset != null) {
                holder.loaded(ruleset, emptyList())
            } else if (loadFailed) {
                holder.failed()
            }
        }
    private var nextId = 0
    val bypasses = BypassRecorder({ bypassEvents += it }) { "event-${++nextId}" }
    val coordinator = GateCoordinator(RulesData.catalog, snapshots, { escalationWrites += it }, intentions, bypasses)

    /** The boot count the exit flow's clock reports; a test changes it to simulate a reboot. */
    var boot = 1
    val exit = ExitFlowController(exitStore, bypasses, disarmer) { ExitTime(mono, boot, wall) }
    private val guard =
        AntiBypassGuard(setOf("monki-focus"), OURS) {
            collisionChecks++
            labelCollision
        }
    val pipeline =
        EventPipeline(
            observer = ScreenObserver(RulesData.catalog, guard),
            evaluator = DecisionEvaluator(RulesData.catalog),
            coordinator = coordinator,
            snapshots = snapshots,
            exitFlow = exit,
            performer = performer,
            labels = { "app" },
            ourPackage = OURS,
            packs = { RulesData.packs },
            unsupportedBrowsers = { unsupportedBrowsers },
        )

    var mono = 100_000L
        private set
    var wall = startWallMs
        private set

    fun advance(ms: Long) {
        mono += ms
        wall += ms
    }

    fun opened(
        screen: Screen,
        afterMs: Long = 1_100,
    ) = event(WindowEventType.STATE_CHANGED, screen, afterMs)

    fun changed(
        screen: Screen,
        afterMs: Long = 1_100,
    ) = event(WindowEventType.CONTENT_CHANGED, screen, afterMs)

    fun event(
        type: WindowEventType,
        screen: Screen,
        afterMs: Long,
    ) {
        advance(afterMs)
        pipeline.onEvent(WindowEvent(type, screen.packageName, mono), wall) { screen }
    }

    fun tick(
        foreground: String?,
        screen: Screen? = null,
        afterMs: Long = 1_000,
    ) {
        advance(afterMs)
        pipeline.onTick(foreground, mono, wall) { screen }
    }

    fun act(action: UserAction) = pipeline.onUserAction(action, wall)

    val showing: OverlayContent? get() = pipeline.showing

    fun phaseOf(group: String) = coordinator.stateOf(group).phase
}
