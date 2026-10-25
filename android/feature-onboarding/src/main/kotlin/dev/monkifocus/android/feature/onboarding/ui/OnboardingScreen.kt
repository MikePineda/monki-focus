// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingMode
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStateMachine
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.flow.StepStatus

/**
 * Onboarding, one step per screen with Back and Next (plan 01 §4). Every
 * decision is [OnboardingStateMachine]'s: this screen shows the step, its
 * live status and sends the user's taps as [OnboardingEvent]s. The host
 * reads [snapshot] again on every resume and while a step waits on a system
 * switch ([LIVE_STEPS]), so the status follows Settings.
 */
@Composable
fun OnboardingScreen(
    progress: OnboardingProgress,
    snapshot: SetupSnapshot,
    battery: BatteryGuidance,
    onEvent: (OnboardingEvent) -> Unit,
    onOpenBatteryGuide: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val step = progress.step
    val path = OnboardingStateMachine.path(progress, snapshot)
    val position = path.indexOf(step).takeIf { it >= 0 } ?: path.count { it.ordinal < step.ordinal }
    Surface(modifier = modifier.fillMaxSize().testTag(OnboardingTestTags.SCREEN), color = MonkiTheme.colors.surface0) {
        Column(
            modifier = Modifier.fillMaxSize().safeDrawingPadding().padding(MonkiSpacing.spaceMd),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .widthIn(max = MonkiSpacing.columnMax)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .testTag(OnboardingTestTags.step(step)),
                verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
            ) {
                Text(
                    text = stringResource(R.string.onboarding_step_count, position + 1, path.size),
                    color = MonkiTheme.colors.ink3,
                    style = MonkiTheme.typography.caption,
                )
                OnboardingStepContent(progress, snapshot, battery, onEvent, onOpenBatteryGuide)
            }
            OnboardingNavigation(progress, snapshot, onEvent)
        }
    }
}

@Composable
private fun OnboardingNavigation(
    progress: OnboardingProgress,
    snapshot: SetupSnapshot,
    onEvent: (OnboardingEvent) -> Unit,
) {
    val step = progress.step
    val showsNext = step != OnboardingStep.TURN_ON && (step != OnboardingStep.DISCLOSURE || progress.disclosureAccepted)
    val optionalPending =
        !OnboardingStateMachine.isRequired(step, progress.mode) &&
            step != OnboardingStep.WELCOME &&
            step != OnboardingStep.DISCLOSURE &&
            OnboardingStateMachine.status(step, progress, snapshot) != StepStatus.DONE
    Row(
        modifier = Modifier.widthIn(max = MonkiSpacing.columnMax).fillMaxWidth().padding(top = MonkiSpacing.spaceMd),
        horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (step != OnboardingStep.WELCOME) {
            MonkiQuietButton(
                text = stringResource(R.string.action_back),
                onClick = { onEvent(OnboardingEvent.Back) },
                modifier = Modifier.testTag(OnboardingTestTags.BACK),
                muted = true,
            )
        }
        if (showsNext) {
            MonkiSecondaryButton(
                text = stringResource(if (optionalPending) R.string.action_skip else R.string.action_next),
                onClick = { onEvent(OnboardingEvent.Next) },
                modifier = Modifier.weight(1f).testTag(OnboardingTestTags.NEXT),
                enabled = OnboardingStateMachine.canAdvance(progress, snapshot),
            )
        }
    }
}

/** Steps whose status changes outside the app (a system switch): the host refreshes the snapshot while one shows. */
val LIVE_STEPS: Set<OnboardingStep> =
    setOf(
        OnboardingStep.RESTRICTED_SETTINGS,
        OnboardingStep.NOTIFICATIONS,
        OnboardingStep.ACCESSIBILITY,
        OnboardingStep.USAGE_ACCESS,
        OnboardingStep.BATTERY,
        OnboardingStep.DEVICE_ADMIN,
        OnboardingStep.TURN_ON,
    )

/** Whether the protection path is the one being walked (statistics only shows fewer steps). */
internal val OnboardingProgress.protects: Boolean get() = mode == OnboardingMode.PROTECTION
