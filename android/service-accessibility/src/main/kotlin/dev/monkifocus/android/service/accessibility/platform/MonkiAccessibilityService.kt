// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import dev.monkifocus.android.service.accessibility.exit.ServiceStart
import dev.monkifocus.android.service.accessibility.gate.GateCoordinator
import dev.monkifocus.android.service.accessibility.guard.AntiBypassGuard
import dev.monkifocus.android.service.accessibility.notice.NoticeContent
import dev.monkifocus.android.service.accessibility.notice.NoticeVisibility
import dev.monkifocus.android.service.accessibility.packs.ActivePacks
import dev.monkifocus.android.service.accessibility.packs.WatchedPackages
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
 * notice up (or the in-app banner when notices are off); the system
 * unbinding it records `accessibility_disabled` (journalled first, so it
 * survives the process going away; `onInterrupt` never does); after "Exit and unlink" it stops enforcing and turns itself
 * off; turned on again after that it turns itself off unless the user
 * asked our app to bring protection back. It logs nothing.
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
    private var unsupportedBrowsers: Set<String> = emptySet()
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
        if (shared.exitFlow.connect() == ServiceStart.DISABLE) {
            // An exit stays an exit: only "Turn protection back on" in our app brings protection back.
            ending = true
            shared.inputs.notifier.reconcile(protectionActive = false, content = NoticeContent.of(false, shared.exitFlow.state))
            disableSelf()
            return
        }
        shared.bypassSink.flush()

        val inputs = shared.inputs
        val screenReader = AccessibilityScreenReader(this)
        val labels = DeviceLabelCollision(this, inputs.ownLabels)
        val overlay =
            OverlayHost(this) { content ->
                val noticeOff by shared.gateRelay.noticeOff.collectAsState()
                OverlayScreen(content, noticeOff = noticeOff, onAction = ::onUserAction)
            }
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
                unsupportedBrowsers = { unsupportedBrowsers },
            )
        reader = screenReader
        performer = androidPerformer
        collision = labels
        shared.gateRelay.onAction = ::onUserAction
        shared.exitFlow.disarmer = ServiceDisarmer()
        ContextCompat.registerReceiver(this, screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
        reconcileNotice()
        load(shared, configured = serviceInfo?.packageNames?.toList().orEmpty())
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

    /**
     * The system interrupts feedback (spoken feedback and the like) for its
     * own reasons; it says nothing about protection being turned off, so it
     * is never recorded as a bypass (an app could otherwise forge one).
     */
    override fun onInterrupt() = Unit

    override fun onUnbind(intent: Intent?): Boolean {
        recordDisabled()
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

    /**
     * Loads off the main thread without leaving a gap: the bundled starter
     * preset and packs (and the browsers of the device) at once, then the
     * stored escalation (retried, conservative if it never reads), the
     * re-verified downloaded packs, and the stored rule set and the label
     * check every minute.
     */
    private fun load(
        shared: ProtectionGraph,
        configured: List<String>,
    ) {
        refresher?.cancel()
        refresher =
            shared.io.launch {
                val inputs = shared.inputs
                val now = Instant.ofEpochMilli(System.currentTimeMillis())
                val bundled = runCatching { inputs.bundledPacks() }.getOrDefault(emptyMap())
                val bundledPacks = runCatching { ActivePacks(inputs.packLoader).load(bundled, emptyMap(), now) }.getOrDefault(emptyList())
                val starter = runCatching { inputs.starterRuleset() }.getOrNull()
                val watched = runCatching { WatchedPackages.of(configured, browsersOnDevice(), packageName, bundledPacks) }.getOrNull()
                handler.post {
                    packs = bundledPacks
                    starter?.let(snapshots::provisional)
                    watched?.let(::watch)
                }
                val stored = readEscalation(inputs)
                handler.post { if (stored != null) snapshots.escalationLoaded(stored) else snapshots.escalationUnavailable() }
                val active =
                    runCatching {
                        val downloaded = DownloadedPackFiles(this@MonkiAccessibilityService).read(bundled.keys)
                        ActivePacks(inputs.packLoader).load(bundled, downloaded, now)
                    }.getOrDefault(bundledPacks)
                handler.post { packs = active }
                while (isActive) {
                    val ruleset: Ruleset? = runCatching { inputs.activeRuleset(instantOf(System.currentTimeMillis())) }.getOrNull()
                    collision?.refresh()
                    handler.post {
                        if (ruleset != null) snapshots.loaded(ruleset) else snapshots.failed()
                        shared.guardianLinked = snapshots.snapshot?.guardianLinked == true
                    }
                    delay(REFRESH_MS)
                }
            }
    }

    /** The stored escalation, retried with a growing pause; null when it never reads. */
    private suspend fun readEscalation(inputs: ProtectionInputs): List<EscalationState>? {
        repeat(ESCALATION_ATTEMPTS) { attempt ->
            runCatching { return inputs.escalationStates.all() }
            delay(RETRY_MS * (attempt + 1))
        }
        return null
    }

    /** Every app that opens an http link: a browser the packs cannot read must not be a way around the rules. */
    private fun browsersOnDevice(): List<String> {
        val view = Intent(Intent.ACTION_VIEW, Uri.parse(BROWSER_PROBE_URL)).addCategory(Intent.CATEGORY_BROWSABLE)
        val found =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.queryIntentActivities(view, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()))
            } else {
                @Suppress("DEPRECATION")
                packageManager.queryIntentActivities(view, PackageManager.MATCH_ALL)
            }
        return found.mapNotNull { it.activityInfo?.packageName }.distinct()
    }

    /** Watches the resolved browsers too, from now on (`setServiceInfo`). */
    private fun watch(watched: WatchedPackages) {
        unsupportedBrowsers = watched.unsupported
        val info = serviceInfo ?: return
        info.packageNames = watched.all.sorted().toTypedArray()
        serviceInfo = info
    }

    private fun schedule() {
        val active = pipeline ?: return
        handler.removeCallbacks(tick)
        active.nextTickDelayMs()?.let { handler.postDelayed(tick, it) }
        handler.removeCallbacks(flush)
        active.flushDelayMs(SystemClock.elapsedRealtime())?.let { handler.postDelayed(flush, it) }
    }

    /** The notice, or the in-app banner when the notice cannot be posted: protection is never active unseen. */
    private fun reconcileNotice() {
        val shared = graph ?: return
        val exit = shared.exitFlow.state
        val active = pipeline != null && exit !is ExitFlowState.Ended
        val notifier = shared.inputs.notifier
        notifier.reconcile(protectionActive = active, content = NoticeContent.of(shared.guardianLinked, exit))
        shared.gateRelay.setNoticeOff(NoticeVisibility.of(active, notifier.permitted()) == NoticeVisibility.BANNER)
    }

    /** Only from `onUnbind`: once per connection, never after a deliberate exit. */
    private fun recordDisabled() {
        val shared = graph ?: return
        if (disabledRecorded || ending || shared.exitFlow.protectionEnded) return
        disabledRecorded = true
        shared.bypasses.record(BypassKind.ACCESSIBILITY_DISABLED, System.currentTimeMillis())
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
            shared.inputs.notifier.reconcile(
                protectionActive = false,
                content = NoticeContent.of(shared.guardianLinked, shared.exitFlow.state),
            )
            shared.gateRelay.setNoticeOff(false)
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
        const val ESCALATION_ATTEMPTS = 3
        const val RETRY_MS = 500L

        /** Any http URL: only which apps can open it matters. */
        const val BROWSER_PROBE_URL = "http://example.org/"
    }
}
