// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

import dev.monkifocus.android.core.domain.rules.AppObservation
import dev.monkifocus.android.core.domain.rules.Decision
import dev.monkifocus.android.core.domain.rules.Observation
import dev.monkifocus.android.core.domain.rules.SiteObservation
import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.GuardedScreen
import dev.monkifocus.android.detectors.Screen
import dev.monkifocus.android.detectors.UnclassifiedTimeCap
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.ActionPerformer
import dev.monkifocus.android.service.accessibility.action.ActionPlan
import dev.monkifocus.android.service.accessibility.action.ActionSelector
import dev.monkifocus.android.service.accessibility.action.BackLoopGuard
import dev.monkifocus.android.service.accessibility.action.CoverRegion
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.action.StatusCard
import dev.monkifocus.android.service.accessibility.decision.DecisionEvaluator
import dev.monkifocus.android.service.accessibility.decision.Evaluation
import dev.monkifocus.android.service.accessibility.decision.RulesetAddition
import dev.monkifocus.android.service.accessibility.decision.SnapshotHolder
import dev.monkifocus.android.service.accessibility.decision.UnclassifiedCapRule
import dev.monkifocus.android.service.accessibility.exit.ExitFlowController
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.gate.CommitResult
import dev.monkifocus.android.service.accessibility.gate.GateCoordinator
import dev.monkifocus.android.service.accessibility.gate.GateGroup

/**
 * The accessibility service's brain (plan §2.4), pure and single-threaded
 * (the service calls it on the main thread). For every event:
 *
 * 1. [ReadThrottle] thins content-changed bursts; a burst's last screen is
 *    read by [flushDeferred];
 * 2. [ScreenObserver] classifies the screen (surface, URL bar → [UrlKey],
 *    our own Settings screens) and feeds [UnclassifiedTimeCap];
 * 3. [DecisionThrottle] lets the engine run only when the target changed or
 *    a second passed; an empty or focused URL bar skips the decision;
 * 4. [DecisionEvaluator] runs the fail-closed `decide`;
 * 5. [ActionSelector] + [GateCoordinator] turn the decision into BACK, HOME,
 *    a gate, a cover or nothing, through the [ActionPerformer].
 *
 * [onTick] keeps the time-driven parts moving between events: pauses,
 * emergency waits, intentions, the exit wait, the cap's sliding window (fed
 * at least every 30 s while a capped app is in front) and leaving a watched
 * app for one we do not watch (the service only receives events of its
 * `packageNames`, so the foreground is polled while an overlay is up).
 *
 * After "Exit and unlink" ends protection nothing is enforced and nothing
 * is shown. The exit flow never asks the engine, so an engine error cannot
 * block it. Clocks are parameters: wall (epoch ms) for the engine, monotonic
 * for throttles, the cap and the DM reel session.
 */
class EventPipeline(
    private val observer: ScreenObserver,
    private val evaluator: DecisionEvaluator,
    private val coordinator: GateCoordinator,
    private val snapshots: SnapshotHolder,
    private val exitFlow: ExitFlowController,
    private val performer: ActionPerformer,
    private val labels: TargetLabels,
    private val ourPackage: String,
    private val packs: () -> List<DetectorPack>,
    /** Browsers resolved on the device that no pack can read (no URL bar ids): friction always, bedtime blocks. */
    private val unsupportedBrowsers: () -> Set<String> = { emptySet() },
    /** Whether the user finished "Turn on protection" in our app (the consent gate). */
    private val armedByUser: () -> Boolean,
    /** Whether the persistent notice can be posted (notification permission). */
    private val noticePermitted: () -> Boolean,
    private val readThrottle: ReadThrottle = ReadThrottle(),
    private val decisionThrottle: DecisionThrottle = DecisionThrottle(),
    private val backGuard: BackLoopGuard = BackLoopGuard(),
) {
    /** A gate screen on display and what it was shown for (no URL: the decision and the label only). */
    private data class Presented(
        val decision: Decision,
        val group: String?,
        val label: String,
        val packageName: String,
        val notice: Boolean,
    )

    private var cap = UnclassifiedTimeCap.INITIAL
    private var foreground: String? = null
    private var foregroundClassified = true
    private var foregroundCapped = false
    private var currentGroup: String? = null
    private var presented: Presented? = null
    private var urlBarMissingPackage: String? = null
    private var urlBarMissingSinceMs = 0L
    private var noticeCardShown = false
    private var setupCardDismissed = false

    /** What our overlay shows now, or null. */
    var showing: OverlayContent? = null
        private set

    /** Whether protection may act now (see [Readiness]). */
    fun readiness(): Readiness = Readiness.of(armedByUser(), noticePermitted(), noticeCardShown)

    /** The service connected: show the setup or the notice-off card when one is due. */
    fun onConnected() {
        if (exitFlow.protectionEnded) return
        showDueCard()
    }

    fun onEvent(
        event: WindowEvent,
        nowEpochMs: Long,
        readScreen: () -> Screen?,
    ) {
        if (!readThrottle.admit(event)) return
        read(event.monotonicMs, nowEpochMs, readScreen)
    }

    /** Reads the last screen of a burst once its interval is over. */
    fun flushDeferred(
        nowMonotonicMs: Long,
        nowEpochMs: Long,
        readScreen: () -> Screen?,
    ) {
        readThrottle.flush(nowMonotonicMs) ?: return
        read(nowMonotonicMs, nowEpochMs, readScreen)
    }

    /** When [flushDeferred] should run, or null when no burst is pending. */
    fun flushDelayMs(nowMonotonicMs: Long): Long? = readThrottle.flushDelayMs(nowMonotonicMs)

    /**
     * The periodic step. [foregroundPackage] is the package of the active
     * window (only its name is read), or null when it could not be read.
     */
    fun onTick(
        foregroundPackage: String?,
        nowMonotonicMs: Long,
        nowEpochMs: Long,
        readScreen: () -> Screen?,
    ) {
        exitFlow.tick()
        if (exitFlow.protectionEnded) {
            stand()
            return
        }
        if (readiness() != Readiness.ACTIVE) {
            showDueCard()
            return
        }
        if (foregroundPackage != null && foregroundPackage != ourPackage && foregroundPackage != foreground &&
            !isWatched(foregroundPackage)
        ) {
            leftForUnwatched(foregroundPackage, nowMonotonicMs)
        } else {
            foreground?.let {
                if (isCapped(it)) {
                    cap =
                        cap.observe(it, foregroundClassified && !urlBarUnread(it, nowMonotonicMs), nowMonotonicMs)
                }
            }
        }
        val changed = coordinator.tick(nowEpochMs, onScreenGroup = presented?.group ?: currentGroup)
        val capFlipped = foreground?.let { capApplies(it, nowMonotonicMs) != foregroundCapped } == true
        when {
            capFlipped || (presented == null && currentGroup != null && currentGroup in changed) -> {
                decisionThrottle.invalidate()
                read(nowMonotonicMs, nowEpochMs, readScreen)
            }

            presented != null -> {
                repaint(nowEpochMs)
            }
        }
        (showing as? OverlayContent.Bounce)?.let { show(bounce(it.screen, nowEpochMs)) }
        // The watched app is in front but our screen is not (GateActivity left with HOME, then the app reopened): show it again.
        if (foregroundPackage != null && foregroundPackage == foreground) showing?.let { if (!performer.isOnTop()) performer.show(it) }
    }

    /** The screen turned off: no app is in front, the cap stops counting. */
    fun onScreenOff(nowMonotonicMs: Long) {
        cap = cap.backgrounded(nowMonotonicMs)
        foreground = null
    }

    /** How soon [onTick] should run again, or null when nothing is time-driven right now. */
    fun nextTickDelayMs(): Long? =
        when {
            exitFlow.state is ExitFlowState.Waiting || showing != null -> FAST_TICK_MS
            coordinator.hasRunningTimers() -> TIMER_TICK_MS
            foreground?.let(::isCapped) == true -> CAP_TICK_MS
            else -> null
        }

    fun onUserAction(
        action: UserAction,
        nowEpochMs: Long,
    ) {
        val shown = presented
        val group = shown?.group
        when (action) {
            UserAction.Close -> {
                group?.let { coordinator.close(it, nowEpochMs) }
                dismiss()
                if (shown?.notice != true) performer.home()
            }

            is UserAction.Continue -> {
                if (group == null) return
                if (coordinator.commit(group, action.intention, action.minutes, nowEpochMs) ==
                    CommitResult.ACCEPTED
                ) {
                    dismiss()
                } else {
                    repaint(nowEpochMs)
                }
            }

            UserAction.Emergency -> {
                group?.let { coordinator.emergency(it, nowEpochMs) }
                repaint(nowEpochMs)
            }

            UserAction.CancelEmergency -> {
                group?.let { coordinator.cancelEmergency(it, nowEpochMs) }
                dismiss()
                if (shown?.notice != true) performer.home()
            }

            UserAction.Extend -> {
                group?.let { coordinator.extend(it, nowEpochMs) }
                repaint(nowEpochMs)
            }

            UserAction.CoverClose, UserAction.BounceBack -> {
                dismiss()
                performer.back()
            }

            UserAction.DisableProtection -> {
                exitFlow.request()
                refreshBounce(nowEpochMs)
            }

            UserAction.KeepProtection -> {
                exitFlow.cancel()
                refreshBounce(nowEpochMs)
            }

            UserAction.OpenApp -> {
                dismiss()
                performer.openApp(notificationSettings = false)
            }

            UserAction.AllowNotifications -> {
                dismiss()
                performer.openApp(notificationSettings = true)
            }

            UserAction.DismissCard -> {
                if ((showing as? OverlayContent.Card)?.card == StatusCard.SETUP) setupCardDismissed = true
                dismiss()
            }
        }
    }

    private fun read(
        nowMonotonicMs: Long,
        nowEpochMs: Long,
        readScreen: () -> Screen?,
    ) {
        if (exitFlow.protectionEnded) {
            stand()
            return
        }
        // The consent gate: nothing is enforced (bedtime included) until the user armed protection in
        // our app, and nothing before the notice or the notice-off card made protection visible.
        if (readiness() != Readiness.ACTIVE) {
            showDueCard()
            return
        }
        if ((showing as? OverlayContent.Card)?.card == StatusCard.SETUP) dismiss()
        val screen = readScreen() ?: return
        handle(observer.observe(screen, packs(), nowMonotonicMs), nowMonotonicMs, nowEpochMs)
    }

    private fun handle(
        observation: ScreenObservation,
        nowMonotonicMs: Long,
        nowEpochMs: Long,
    ) {
        val pkg = observation.packageName
        if (presented?.let { it.notice && it.packageName != pkg } == true) presented = null
        if (observation !is ScreenObservation.UrlAbsent) urlBarMissingPackage = null
        when (observation) {
            is ScreenObservation.Guarded -> {
                feedCap(pkg, classified = true, nowMonotonicMs)
                presented = null
                currentGroup = null
                show(bounce(observation.screen, nowEpochMs))
            }

            is ScreenObservation.Untracked -> {
                feedCap(pkg, classified = true, nowMonotonicMs)
                val ruleset = snapshots.snapshot?.ruleset
                if (pkg !in unsupportedBrowsers() || (ruleset != null && !UnclassifiedCapRule.coversWeb(ruleset))) {
                    currentGroup = null
                    dismiss()
                    return
                }
                val key = ObservationKey.App(pkg, null)
                if (!decisionThrottle.admit(key, nowMonotonicMs)) return
                val addition = RulesetAddition.UnsupportedBrowser(pkg)
                decideAndAct(
                    AppObservation(pkg, null),
                    key,
                    CoverRegion.NONE,
                    addition,
                    labels.appLabel(pkg),
                    pkg,
                    nowMonotonicMs,
                    nowEpochMs,
                )
            }

            is ScreenObservation.Unguarded -> {
                feedCap(pkg, classified = true, nowMonotonicMs)
                currentGroup = null
                dismiss()
            }

            is ScreenObservation.UrlBeingEdited -> {
                feedCap(pkg, classified = true, nowMonotonicMs)
                if (showing is OverlayContent.Cover) dismiss()
            }

            is ScreenObservation.UrlAbsent -> {
                if (urlBarMissingPackage != pkg) {
                    urlBarMissingPackage = pkg
                    urlBarMissingSinceMs = nowMonotonicMs
                }
                // Past the grace a browser that shows no URL bar counts as unclassified: no fail-open by hiding the bar.
                val unread = urlBarUnread(pkg, nowMonotonicMs)
                feedCap(pkg, classified = !unread, nowMonotonicMs)
                if (!unread) return
                val capped = capApplies(pkg, nowMonotonicMs)
                foregroundCapped = capped
                if (!capped) return
                val key = ObservationKey.App(pkg, null, capped = true)
                if (!decisionThrottle.admit(key, nowMonotonicMs)) return
                val addition = RulesetAddition.UnclassifiedCap(pkg)
                decideAndAct(
                    AppObservation(pkg, null),
                    key,
                    CoverRegion.NONE,
                    addition,
                    labels.appLabel(pkg),
                    pkg,
                    nowMonotonicMs,
                    nowEpochMs,
                )
            }

            is ScreenObservation.App -> {
                feedCap(pkg, classified = observation.surface != null, nowMonotonicMs)
                val capped = capApplies(pkg, nowMonotonicMs)
                foregroundCapped = capped
                val key = ObservationKey.App(pkg, observation.surface, capped)
                if (!decisionThrottle.admit(key, nowMonotonicMs)) return
                val target = AppObservation(pkg, observation.surface)
                decideAndAct(
                    target,
                    key,
                    observation.cover,
                    if (capped) RulesetAddition.UnclassifiedCap(pkg) else null,
                    labels.appLabel(pkg),
                    pkg,
                    nowMonotonicMs,
                    nowEpochMs,
                )
            }

            is ScreenObservation.Site -> {
                feedCap(pkg, classified = true, nowMonotonicMs)
                val key = observation.observationKey
                if (!decisionThrottle.admit(key, nowMonotonicMs)) return
                val label = observation.key.host.ifEmpty { labels.appLabel(pkg) }
                decideAndAct(SiteObservation(observation.urlText), key, observation.cover, null, label, pkg, nowMonotonicMs, nowEpochMs)
            }
        }
    }

    private fun decideAndAct(
        target: Observation,
        key: ObservationKey,
        cover: CoverRegion,
        addition: RulesetAddition?,
        label: String,
        pkg: String,
        nowMonotonicMs: Long,
        nowEpochMs: Long,
    ) {
        val snapshot = snapshots.snapshot
        // Before the first load there is nothing to decide with; a failed load fails closed below.
        if (snapshot == null && !snapshots.loadFailed) return
        val evaluation = evaluator.evaluate(snapshot, target, addition, nowEpochMs)
        currentGroup = GateGroup.of(evaluation.decision)
        when (val plan = ActionSelector.select(evaluation, cover) { coordinator.stateOf(it).phase }) {
            ActionPlan.Clear -> {
                if (presented?.notice != true) dismiss()
            }

            is ActionPlan.Cover -> {
                presented = null
                show(OverlayContent.Cover(plan.region))
            }

            ActionPlan.Gate -> {
                present(evaluation, label, pkg, notice = false, nowEpochMs)
            }

            ActionPlan.BackWithNotice -> {
                when (backGuard.next(key, nowMonotonicMs)) {
                    BackLoopGuard.Step.BACK -> performer.back()
                    BackLoopGuard.Step.HOME -> performer.home()
                }
                present(evaluation, label, pkg, notice = true, nowEpochMs)
                // A BACK should change the screen: if the same surface is still there, decide again at once.
                decisionThrottle.invalidate()
            }
        }
    }

    private fun present(
        evaluation: Evaluation,
        label: String,
        pkg: String,
        notice: Boolean,
        nowEpochMs: Long,
    ) {
        val state = coordinator.present(evaluation, label, nowEpochMs)
        if (state == GateUiState.Hidden) {
            dismiss()
            return
        }
        val group = GateGroup.of(evaluation.decision)
        presented = Presented(evaluation.decision, group, label, pkg, notice)
        show(OverlayContent.Gate(state, group, notice))
    }

    /** Re-renders the gate on screen from its group's current state (countdowns, transitions). */
    private fun repaint(nowEpochMs: Long) {
        val shown = presented ?: return
        val state =
            shown.group?.let { coordinator.presentGroup(it, shown.decision, shown.label, nowEpochMs) }
                ?: (showing as? OverlayContent.Gate)?.state
                ?: GateUiState.Hidden
        if (state == GateUiState.Hidden) {
            dismiss()
            return
        }
        show(OverlayContent.Gate(state, shown.group, shown.notice))
    }

    /** The card the current [Readiness] calls for, if any; the notice-off card once per session. */
    private fun showDueCard() {
        when (readiness()) {
            Readiness.NOT_ARMED -> {
                if (showing !is OverlayContent.Card && showing != null) stand()
                if (!setupCardDismissed) show(OverlayContent.Card(StatusCard.SETUP))
            }

            Readiness.AWAITING_NOTICE_CARD -> {
                show(OverlayContent.Card(StatusCard.NOTICE_OFF))
                noticeCardShown = true
            }

            Readiness.ACTIVE -> {
                Unit
            }
        }
    }

    private fun refreshBounce(nowEpochMs: Long) {
        (showing as? OverlayContent.Bounce)?.let { show(bounce(it.screen, nowEpochMs)) }
    }

    private fun bounce(
        screen: GuardedScreen,
        nowEpochMs: Long,
    ): OverlayContent =
        OverlayContent.Bounce(
            screen = screen,
            exitRemainingSeconds = exitFlow.remainingSeconds(),
            guardianLinked = snapshots.snapshot?.guardianLinked == true,
        )

    private fun leftForUnwatched(
        pkg: String,
        nowMonotonicMs: Long,
    ) {
        feedCap(pkg, classified = true, nowMonotonicMs)
        currentGroup = null
        presented = null
        dismiss()
    }

    private fun feedCap(
        pkg: String,
        classified: Boolean,
        nowMonotonicMs: Long,
    ) {
        cap = cap.observe(pkg, classified, nowMonotonicMs)
        foreground = pkg
        foregroundClassified = classified
        foregroundCapped = false
    }

    /** The cap of [pkg] in minutes: its app pack's, the compiled browser cap for a readable browser, or null. */
    private fun capMinutesOf(pkg: String): Int? {
        val applicable = packs().filter { it.appliesTo(pkg) }
        if (applicable.any { it.urlBarViewIds.isNotEmpty() }) return BROWSER_CAP_MINUTES
        return applicable
            .firstOrNull { it.unclassifiedCapMinutes > 0 && it.packId != ScreenObserver.SETTINGS_PACK_ID }
            ?.unclassifiedCapMinutes
    }

    private fun isCapped(pkg: String): Boolean = capMinutesOf(pkg) != null

    private fun isWatched(pkg: String): Boolean = packs().any { it.appliesTo(pkg) } || pkg in unsupportedBrowsers()

    private fun urlBarUnread(
        pkg: String,
        nowMonotonicMs: Long,
    ): Boolean = urlBarMissingPackage == pkg && nowMonotonicMs - urlBarMissingSinceMs > URL_BAR_GRACE_MS

    private fun capApplies(
        pkg: String,
        nowMonotonicMs: Long,
    ): Boolean {
        val minutes = capMinutesOf(pkg) ?: return false
        val ruleset = snapshots.snapshot?.ruleset ?: return false
        val applicable = packs().filter { it.appliesTo(pkg) }
        val covered =
            if (applicable.any { it.urlBarViewIds.isNotEmpty() }) {
                UnclassifiedCapRule.coversWeb(ruleset)
            } else {
                applicable.any { UnclassifiedCapRule.covers(ruleset, it) }
            }
        return cap.frictionApplies(pkg, minutes, covered, nowMonotonicMs)
    }

    /** Shows [content] unless exactly that is already on top (never trusts "showing" while our host is not in front). */
    private fun show(content: OverlayContent) {
        if (content == showing && performer.isOnTop()) return
        showing = content
        performer.show(content)
    }

    /** Removes our overlay, if any, and lets the next observation decide afresh. */
    private fun dismiss() {
        presented = null
        if (showing == null) return
        showing = null
        decisionThrottle.invalidate()
        performer.clear()
    }

    /** Protection ended: nothing of ours stays on screen. */
    private fun stand() {
        presented = null
        currentGroup = null
        if (showing == null) return
        showing = null
        performer.clear()
    }

    private companion object {
        /** Countdowns, the exit wait and the foreground poll while an overlay is up. */
        const val FAST_TICK_MS = 1_000L

        /** Intentions and overrides running with nothing on screen. */
        const val TIMER_TICK_MS = 15_000L

        /** Keeps the unclassified cap fed (it accounts at most 60 s per observation). */
        const val CAP_TICK_MS = 30_000L

        /** A browser may hide its URL bar this long (scrolling, a video) before the screen counts as unclassified. */
        const val URL_BAR_GRACE_MS = 30_000L

        /** The unclassified cap of readable browsers whose URL bar stays hidden (the packs' minimum for capped apps). */
        const val BROWSER_CAP_MINUTES = 5
    }
}
