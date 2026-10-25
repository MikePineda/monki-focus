// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEffect
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingMode
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStateMachine
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.platform.SetupIntents
import dev.monkifocus.android.feature.onboarding.platform.startFirst
import dev.monkifocus.android.feature.onboarding.status.ActiveRulesSummary
import dev.monkifocus.android.feature.onboarding.status.ProtectionState
import dev.monkifocus.android.feature.onboarding.status.StatusChecklist
import dev.monkifocus.android.feature.onboarding.ui.DisclosureAgainScreen
import dev.monkifocus.android.feature.onboarding.ui.LIVE_STEPS
import dev.monkifocus.android.feature.onboarding.ui.OnboardingScreen
import dev.monkifocus.android.feature.onboarding.ui.StatusUi
import dev.monkifocus.android.feature.rules.ui.RulesRoute
import dev.monkifocus.android.feature.stats.ui.StatsRoute
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.ui.ExitAndUnlinkScreen
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Launcher entry point, always visible in the launcher (no hidden mode
 * exists), and the app's only navigation: onboarding until protection is on
 * (or the user chose statistics only), then the Status screen, the rules
 * screen, the statistics and "Exit and unlink" (opened directly by the protection notice's
 * action, [EXTRA_OPEN_EXIT]).
 *
 * Consent order (plan 04 §2): the accessibility disclosure comes before any
 * intent to accessibility settings, the notification permission is asked in
 * its own step, and `armedByUser` is set only by the last step once every
 * required step is done (`OnboardingStateMachine`). The permissions are read
 * again on every resume and every second while a step waits on a switch.
 */
class MainActivity : ComponentActivity() {
    private enum class Route { HOME, ONBOARDING, DISCLOSURE_AGAIN, RULES, EXIT, STATS }

    private var route by mutableStateOf(Route.HOME)
    private var snapshot by mutableStateOf(SetupSnapshot.NOTHING)
    private var home by mutableStateOf(HomeStatus(noticePermitted = true, noticeOffBanner = false))
    private var protectionState by mutableStateOf(ProtectionState.SETUP_UNFINISHED)
    private var progress by mutableStateOf(OnboardingProgress())
    private var rulesSummary by mutableStateOf<ActiveRulesSummary?>(null)
    private var rulesUnavailable by mutableStateOf(false)
    private var armed by mutableStateOf(false)
    private var askedForNotice = false
    private var resumes by mutableIntStateOf(0)

    private val graph: AppGraph get() = (application as MonkiApplication).graph

    private val probe: SystemSetupProbe by lazy {
        SystemSetupProbe(this, { graph.accessibilityServiceEnabled() }, graph.deviceAdminReceiver)
    }

    private val battery: BatteryGuidance by lazy { BatteryGuidance.forManufacturer(Build.MANUFACTURER) }

    private val requestNotice =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            askedForNotice = true
            refresh()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        progress = graph.onboarding.progress
        storeStarterRules()
        // Opening the app keeps the periodic jobs, ingests usage now and re-plans the bedtime warning.
        graph.background.onAppOpen()
        refresh()
        route =
            when {
                intent?.getBooleanExtra(EXTRA_OPEN_EXIT, false) == true -> Route.EXIT
                OnboardingStateMachine.needsReconsent(progress, armed) -> Route.DISCLOSURE_AGAIN
                needsOnboarding() -> Route.ONBOARDING
                else -> Route.HOME
            }
        setContent {
            MonkiTheme {
                LaunchedEffect(route, progress.step) {
                    if (route == Route.ONBOARDING && progress.step in LIVE_STEPS) {
                        while (true) {
                            delay(REFRESH_MS)
                            refresh()
                        }
                    }
                }
                LaunchedEffect(route) {
                    if (route == Route.HOME) {
                        val rules =
                            try {
                                withContext(Dispatchers.Default) { graph.ruleChanges.state() }
                            } catch (cancelled: CancellationException) {
                                throw cancelled
                            } catch (_: Exception) {
                                // An undecodable stored set: the service fails closed; Status and Exit and unlink stay usable.
                                null
                            }
                        rulesUnavailable = rules == null
                        rulesSummary = rules?.let { ActiveRulesSummary.of(it.effective, it.pending?.effectiveFrom) }
                    }
                }
                BackHandler(enabled = route == Route.RULES || route == Route.EXIT || route == Route.STATS) { goHome() }
                BackHandler(enabled = route == Route.ONBOARDING && progress.step != OnboardingStep.WELCOME) {
                    onOnboardingEvent(OnboardingEvent.Back)
                }
                when (route) {
                    Route.EXIT -> {
                        ExitAndUnlinkScreen(exitFlow = graph.protection.exitFlow, onDone = ::goHome, onRearm = ::startSetup)
                    }

                    Route.DISCLOSURE_AGAIN -> {
                        DisclosureAgainScreen(
                            onAgree = {
                                graph.onboarding.reconsent()
                                progress = graph.onboarding.progress
                                goHome()
                            },
                            // Declining never disarms silently: Exit and unlink explains how protection ends.
                            onNotNow = { route = Route.EXIT },
                        )
                    }

                    Route.STATS -> {
                        StatsRoute(
                            loader = graph.stats,
                            clock = { graph.wallClock.millis() },
                            onBack = ::goHome,
                            onFixUsageAccess = { fix(OnboardingStep.USAGE_ACCESS) },
                            refreshKey = resumes,
                        )
                    }

                    Route.RULES -> {
                        RulesRoute(service = graph.ruleChanges, validator = { graph.rules.validator }, onBack = ::goHome)
                    }

                    Route.ONBOARDING -> {
                        OnboardingScreen(
                            progress = progress,
                            snapshot = snapshot,
                            battery = battery,
                            onEvent = ::onOnboardingEvent,
                            onOpenBatteryGuide = { startFirst(SetupIntents.webPage(battery.url)) },
                        )
                    }

                    Route.HOME -> {
                        StatusHome(
                            home = home,
                            status =
                                StatusUi(
                                    protection = protectionState,
                                    checklist = StatusChecklist.of(snapshot, StatusChecklist.protectionWanted(armed, progress.mode)),
                                    rules = rulesSummary,
                                    noticePermitted = home.noticePermitted,
                                    rulesUnavailable = rulesUnavailable,
                                ),
                            onFix = ::fix,
                            onRequestNotice = ::askForNotice,
                            onTurnOn = ::startSetup,
                            onEditRules = { route = Route.RULES },
                            onExitAndUnlink = { route = Route.EXIT },
                            onOpenStats = { route = Route.STATS },
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
        resumes++
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_OPEN_EXIT, false)) route = Route.EXIT
    }

    private fun refresh() {
        val current = probe.snapshot()
        armed = graph.protection.preferences.armedByUser
        val exit = graph.protection.exitFlow.state
        snapshot = current
        home = HomeStatus.of(current.accessibilityService, armed, exit, current.notifications)
        protectionState =
            ProtectionState.of(
                serviceEnabled = current.accessibilityService,
                armedByUser = armed,
                exitWaiting = exit is ExitFlowState.Waiting,
                exitEnded = exit is ExitFlowState.Ended,
                statsOnly = progress.completed && progress.mode == OnboardingMode.STATS_ONLY,
            )
    }

    private fun needsOnboarding(): Boolean = !graph.protection.preferences.armedByUser && !progress.completed

    private fun goHome() {
        route = Route.HOME
        refresh()
    }

    private fun onOnboardingEvent(event: OnboardingEvent) {
        val effect = graph.onboarding.handle(event, snapshot)
        progress = graph.onboarding.progress
        when (effect) {
            is OnboardingEffect.Open -> open(effect.step)
            OnboardingEffect.Arm -> turnOnProtection()
            OnboardingEffect.FinishStatsOnly -> goHome()
            null -> Unit
        }
        refresh()
    }

    /** The prompt or system screen of [step]; reached only through the onboarding rules or a Status fix button. */
    private fun open(step: OnboardingStep) {
        when (step) {
            OnboardingStep.RESTRICTED_SETTINGS -> {
                startFirst(SetupIntents.appInfo(packageName))
            }

            OnboardingStep.NOTIFICATIONS -> {
                askForNotice()
            }

            OnboardingStep.ACCESSIBILITY -> {
                startFirst(SetupIntents.accessibility(graph.accessibilityService))
            }

            OnboardingStep.USAGE_ACCESS -> {
                startFirst(SetupIntents.usageAccess(packageName))
            }

            OnboardingStep.BATTERY -> {
                startFirst(SetupIntents.batteryOptimisation(packageName))
            }

            OnboardingStep.DEVICE_ADMIN -> {
                startFirst(
                    SetupIntents.deviceAdmin(graph.deviceAdminReceiver, getString(CoreUiR.string.device_admin_description)),
                )
            }

            OnboardingStep.WELCOME, OnboardingStep.DISCLOSURE, OnboardingStep.TURN_ON -> {
                Unit
            }
        }
    }

    /**
     * A Status fix button, through the onboarding rules like any step's own
     * button: what onboarding would not open yet (accessibility before the
     * disclosure, anything but usage access and notifications with
     * statistics only) leads to onboarding instead.
     */
    private fun fix(step: OnboardingStep) {
        val effect = graph.onboarding.handle(OnboardingEvent.Act(step), snapshot)
        progress = graph.onboarding.progress
        if (effect is OnboardingEffect.Open) open(effect.step) else startSetup()
    }

    /**
     * "Turn on protection" from Status (or "Turn protection back on" after an
     * exit): onboarding again from its first missing required step. After an
     * exit the next service start may re-arm (`allowRearm`), but nothing is
     * enforced until the last step sets `armedByUser`.
     */
    private fun startSetup() {
        val exitFlow = graph.protection.exitFlow
        if (exitFlow.state is ExitFlowState.Ended) exitFlow.allowRearm()
        graph.onboarding.restart(snapshot)
        progress = graph.onboarding.progress
        route = Route.ONBOARDING
        refresh()
    }

    private fun needsNoticePermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    /**
     * The system prompt while Android still shows it (the first time, and
     * once more after a refusal with its rationale); after that, or with app
     * notifications turned off, the app's notification settings.
     */
    private fun askForNotice() {
        val prompt =
            needsNoticePermission() &&
                (!askedForNotice || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))
        if (prompt) {
            requestNotice.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            startFirst(SetupIntents.notificationSettings(packageName))
        }
    }

    /**
     * The last onboarding step, the consent gate: only now is protection
     * armed. A service turned on straight from system Settings enforces
     * nothing until this ran.
     */
    private fun turnOnProtection() {
        val exitFlow = graph.protection.exitFlow
        if (exitFlow.state is ExitFlowState.Ended) exitFlow.allowRearm()
        storeStarterRules()
        graph.protection.armByUser()
        goHome()
    }

    /**
     * Stores the bundled starter once, pinned to the device zone of this
     * moment (idempotent), so the engine's pinned zone governs from then on
     * instead of each process's device zone. Runs on the first start and when
     * protection is armed; until it lands the service applies the same
     * starter. A failure leaves the starter in force and is tried again on the
     * next start.
     */
    private fun storeStarterRules() {
        val zone = ZoneId.systemDefault().id
        graph.protection.io.launch { runCatching { graph.ruleChanges.ensureStored(zone) } }
    }

    companion object {
        /** Opens "Exit and unlink" (the protection notice's action). */
        const val EXTRA_OPEN_EXIT = "dev.monkifocus.android.extra.OPEN_EXIT"

        private const val REFRESH_MS = 1_000L
    }
}
