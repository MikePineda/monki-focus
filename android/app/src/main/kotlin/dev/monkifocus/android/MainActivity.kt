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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEffect
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingMode
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.platform.SetupIntents
import dev.monkifocus.android.feature.onboarding.platform.startFirst
import dev.monkifocus.android.feature.onboarding.status.ActiveRulesSummary
import dev.monkifocus.android.feature.onboarding.status.ProtectionState
import dev.monkifocus.android.feature.onboarding.status.StatusChecklist
import dev.monkifocus.android.feature.onboarding.ui.LIVE_STEPS
import dev.monkifocus.android.feature.onboarding.ui.OnboardingScreen
import dev.monkifocus.android.feature.onboarding.ui.StatusUi
import dev.monkifocus.android.feature.rules.ui.RulesRoute
import dev.monkifocus.android.service.accessibility.exit.ExitFlowState
import dev.monkifocus.android.service.accessibility.ui.ExitAndUnlinkScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Launcher entry point, always visible in the launcher (no hidden mode
 * exists), and the app's only navigation: onboarding until protection is on
 * (or the user chose statistics only), then the Status screen, the rules
 * screen and "Exit and unlink" (opened directly by the protection notice's
 * action, [EXTRA_OPEN_EXIT]).
 *
 * Consent order (plan 04 §2): the accessibility disclosure comes before any
 * intent to accessibility settings, the notification permission is asked in
 * its own step, and `armedByUser` is set only by the last step once every
 * required step is done (`OnboardingStateMachine`). The permissions are read
 * again on every resume and every second while a step waits on a switch.
 */
class MainActivity : ComponentActivity() {
    private enum class Route { HOME, ONBOARDING, RULES, EXIT }

    private var route by mutableStateOf(Route.HOME)
    private var snapshot by mutableStateOf(SetupSnapshot.NOTHING)
    private var home by mutableStateOf(HomeStatus(noticePermitted = true, noticeOffBanner = false))
    private var protectionState by mutableStateOf(ProtectionState.SETUP_UNFINISHED)
    private var progress by mutableStateOf(OnboardingProgress())
    private var rulesSummary by mutableStateOf<ActiveRulesSummary?>(null)
    private var askedForNotice = false

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
        refresh()
        route =
            when {
                intent?.getBooleanExtra(EXTRA_OPEN_EXIT, false) == true -> Route.EXIT
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
                        val rules = withContext(Dispatchers.Default) { graph.ruleChanges.state() }
                        rulesSummary = ActiveRulesSummary.of(rules.effective, rules.pending?.effectiveFrom)
                    }
                }
                BackHandler(enabled = route == Route.RULES || route == Route.EXIT) { goHome() }
                BackHandler(enabled = route == Route.ONBOARDING && progress.step != OnboardingStep.WELCOME) {
                    onOnboardingEvent(OnboardingEvent.Back)
                }
                when (route) {
                    Route.EXIT -> {
                        ExitAndUnlinkScreen(exitFlow = graph.protection.exitFlow, onDone = ::goHome, onRearm = ::startSetup)
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
                                    checklist = StatusChecklist.of(snapshot, protectionWanted()),
                                    rules = rulesSummary,
                                    noticePermitted = home.noticePermitted,
                                ),
                            onFix = ::fix,
                            onRequestNotice = ::askForNotice,
                            onTurnOn = ::startSetup,
                            onEditRules = { route = Route.RULES },
                            onExitAndUnlink = { route = Route.EXIT },
                        )
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_OPEN_EXIT, false)) route = Route.EXIT
    }

    private fun refresh() {
        val current = probe.snapshot()
        val armed = graph.protection.preferences.armedByUser
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

    private fun protectionWanted(): Boolean = progress.mode == OnboardingMode.PROTECTION

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
     * A Status fix button. The accessibility screens open only once the
     * disclosure was accepted; before that the button leads to onboarding,
     * which shows the disclosure first.
     */
    private fun fix(step: OnboardingStep) {
        if (step == OnboardingStep.ACCESSIBILITY && !progress.disclosureAccepted) {
            startSetup()
        } else {
            open(step)
        }
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
        graph.protection.armByUser()
        goHome()
    }

    companion object {
        /** Opens "Exit and unlink" (the protection notice's action). */
        const val EXTRA_OPEN_EXIT = "dev.monkifocus.android.extra.OPEN_EXIT"

        private const val REFRESH_MS = 1_000L
    }
}
