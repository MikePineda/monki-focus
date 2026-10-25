// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import androidx.core.content.ContextCompat
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.service.accessibility.bypass.BypassKind
import dev.monkifocus.android.service.accessibility.decision.DecisionEvaluator
import dev.monkifocus.android.service.accessibility.decision.SnapshotHolder
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.exit.ProtectionDisarmer
import dev.monkifocus.android.service.accessibility.gate.GateCoordinator
import dev.monkifocus.android.service.accessibility.guard.AntiBypassGuard
import dev.monkifocus.android.service.accessibility.notice.NoticeContent
import dev.monkifocus.android.service.accessibility.packs.ActivePacks
import dev.monkifocus.android.service.accessibility.pipeline.EventPipeline
import dev.monkifocus.android.service.accessibility.pipeline.ScreenObserver
import dev.monkifocus.android.service.accessibility.pipeline.UserAction
import dev.monkifocus.android.service.accessibility.pipeline.WindowEvent
import dev.monkifocus.android.service.accessibility.pipeline.WindowEventType
import dev.monkifocus.android.service.accessibility.ui.OverlayScreen
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * The accessibility service: a thin adapter around [EventPipeline]. It
 * turns events into [WindowEvent]s, passes `System.currentTimeMillis()` and
 * `SystemClock.elapsedRealtime()` as the clocks, schedules the pipeline's
 * ticks on the main looper and loads the rules and packs off the main
 * thread. Every decision and action is the pipeline's.
 *
 * Anti-stalkerware (plan 04 §2): while connected it keeps the persistent
 * notice up; the system unbinding or interrupting it records
 * `accessibility_disabled` (journalled first, so it survives the process
 * going away); after "Exit and unlink" it stops enforcing and turns itself
 * off, and turning it on again later re-arms protection. It logs nothing.
 */
class MonkiAccessibilityService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val snapshots = SnapshotHolder()
    private var graph: ProtectionGraph? = null
    private var pipeline: EventPipeline? = null
    private var reader: AccessibilityScreenReader? = null
    private var performer: AndroidActionPerformer? = null
    private var collision: DeviceLabelCollision? = null
    private var refresher: Job? = null
    private var packs: List<DetectorPack> = emptyList()
    private var disabledRecorded = false
    private var ending = false

    private val tick =
        Runnable {
            val active = pipeline ?: return@Runnable
            active.onTick(reader?.foregroundPackage(), SystemClock.elapsedRealtime(), System.currentTimeMillis(), ::readScreen)
            reconcileNotice()
            schedule()
        }

    private val flush =
        Runnable {
            pipeline?.flushDeferred(SystemClock.elapsedRealtime(), System.currentTimeMillis(), ::readScreen)
            schedule()
        }

    private val screenOff =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context,
                intent: Intent,
            ) {
                pipeline?.onScreenOff(SystemClock.elapsedRealtime())
            }
        }

    public override fun onServiceConnected() {
        super.onServiceConnected()
        val shared = (application as ProtectionGraphProvider).protectionGraph
        graph = shared
        disabledRecorded = false
        ending = false
        // Turning the service on again after an exit is a deliberate choice: protection is back.
        if (shared.exitFlow.state is ExitFlowState.Ended) shared.exitFlow.rearm(System.currentTimeMillis())
        shared.bypassSink.flush()

        val inputs = shared.inputs
        val screenReader = AccessibilityScreenReader(this)
        val labels = DeviceLabelCollision(this, inputs.ownLabels)
        val overlay = OverlayHost(this) { content -> OverlayScreen(content, onAction = ::onUserAction) }
        val androidPerformer = AndroidActionPerformer(this, overlay, shared.gateRelay, shared.preferences, handler)
        val coordinator =
            GateCoordinator(
                catalog = inputs.catalog,
                snapshots = snapshots,
                sink = RepositoryEscalationSink(inputs.escalationStates, shared.io),
                intentions = RepositoryIntentionLog(inputs.intentions, shared.io),
                bypasses = shared.bypasses,
            )
        pipeline =
            EventPipeline(
                observer = ScreenObserver(inputs.catalog, AntiBypassGuard(inputs.ownLabels, packageName) { labels.exists() }),
                evaluator = DecisionEvaluator(inputs.catalog),
                coordinator = coordinator,
                snapshots = snapshots,
                exitFlow = shared.exitFlow,
                performer = androidPerformer,
                labels = AppLabels(this),
                ourPackage = packageName,
                packs = { packs },
            )
        reader = screenReader
        performer = androidPerformer
        collision = labels
        shared.gateRelay.onAction = ::onUserAction
        shared.exitFlow.disarmer = ServiceDisarmer()
        ContextCompat.registerReceiver(this, screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
        reconcileNotice()
        load(shared)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val active = pipeline ?: return
        val type =
            when (event?.eventType) {
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> WindowEventType.STATE_CHANGED
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> WindowEventType.CONTENT_CHANGED
                else -> return
            }
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return
        active.onEvent(WindowEvent(type, pkg, SystemClock.elapsedRealtime()), System.currentTimeMillis(), ::readScreen)
        schedule()
    }

    override fun onInterrupt() {
        recordDisabled(VIA_INTERRUPT)
    }

    override fun onUnbind(intent: Intent?): Boolean {
        recordDisabled(VIA_UNBIND)
        teardown()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        teardown()
        super.onDestroy()
    }

    private fun onUserAction(action: UserAction) {
        pipeline?.onUserAction(action, System.currentTimeMillis())
        reconcileNotice()
        schedule()
    }

    private fun readScreen() = reader?.read()

    /** Rules, escalation and packs off the main thread; the rule set and labels again every minute. */
    private fun load(shared: ProtectionGraph) {
        refresher?.cancel()
        refresher =
            shared.io.launch {
                val inputs = shared.inputs
                val stored: List<EscalationState> = runCatching { inputs.escalationStates.all() }.getOrDefault(emptyList())
                val loadedPacks =
                    runCatching {
                        val bundled = inputs.bundledPacks()
                        ActivePacks(inputs.packLoader).load(
                            bundled,
                            DownloadedPackFiles(this@MonkiAccessibilityService).read(bundled.keys),
                            Instant.ofEpochMilli(System.currentTimeMillis()),
                        )
                    }.getOrDefault(emptyList())
                handler.post { packs = loadedPacks }
                while (isActive) {
                    val ruleset: Ruleset? = runCatching { inputs.activeRuleset(instantOf(System.currentTimeMillis())) }.getOrNull()
                    collision?.refresh()
                    handler.post {
                        if (ruleset != null) snapshots.loaded(ruleset, stored) else snapshots.failed()
                    }
                    delay(REFRESH_MS)
                }
            }
    }

    private fun schedule() {
        val active = pipeline ?: return
        handler.removeCallbacks(tick)
        active.nextTickDelayMs()?.let { handler.postDelayed(tick, it) }
        handler.removeCallbacks(flush)
        active.flushDelayMs(SystemClock.elapsedRealtime())?.let { handler.postDelayed(flush, it) }
    }

    private fun reconcileNotice() {
        val shared = graph ?: return
        val exit = shared.exitFlow.state
        shared.inputs.notifier.reconcile(
            protectionActive = pipeline != null && exit !is ExitFlowState.Ended,
            content =
                NoticeContent(
                    guardianLinked = snapshots.snapshot?.guardianLinked == true,
                    exitPending = exit is ExitFlowState.Waiting,
                ),
        )
    }

    /** Best effort, once per connection, never after a deliberate exit. */
    private fun recordDisabled(via: String) {
        val shared = graph ?: return
        if (disabledRecorded || ending || shared.exitFlow.protectionEnded) return
        disabledRecorded = true
        shared.bypasses.record(BypassKind.ACCESSIBILITY_DISABLED, System.currentTimeMillis(), details = mapOf(DETAIL_VIA to via))
    }

    private fun teardown() {
        handler.removeCallbacks(tick)
        handler.removeCallbacks(flush)
        refresher?.cancel()
        refresher = null
        performer?.clear()
        performer = null
        pipeline = null
        graph?.let { shared ->
            shared.gateRelay.onAction = null
            shared.exitFlow.disarmer = null
            shared.inputs.notifier.reconcile(protectionActive = false, content = NoticeContent(guardianLinked = false, exitPending = false))
        }
        runCatching { unregisterReceiver(screenOff) }
    }

    /** The end of "Exit and unlink" while the service runs: everything off, then the service itself. */
    private inner class ServiceDisarmer : ProtectionDisarmer {
        override fun disarmDeviceAdmin() {
            graph?.let {
                DeviceAdminDisarmer(
                    this@MonkiAccessibilityService,
                    it.inputs.deviceAdmin,
                    it.inputs.notifier,
                ).disarmDeviceAdmin()
            }
        }

        override fun stopProtection() {
            ending = true
            performer?.clear()
            reconcileNotice()
            disableSelf()
        }
    }

    private companion object {
        const val REFRESH_MS = 60_000L
        const val DETAIL_VIA = "via"
        const val VIA_UNBIND = "unbind"
        const val VIA_INTERRUPT = "interrupt"
    }
}
