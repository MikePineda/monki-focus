// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiInkButton
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.onboarding.flow.BatteryGuidance
import dev.monkifocus.android.feature.onboarding.flow.OnboardingEvent
import dev.monkifocus.android.feature.onboarding.flow.OnboardingProgress
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStateMachine
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.flow.RestrictedSettings
import dev.monkifocus.android.feature.onboarding.flow.SetupSnapshot
import dev.monkifocus.android.feature.onboarding.flow.StepStatus

/** The body of the current onboarding step: what it is for, its live status and its own button. */
@Composable
internal fun OnboardingStepContent(
    progress: OnboardingProgress,
    snapshot: SetupSnapshot,
    battery: BatteryGuidance,
    onEvent: (OnboardingEvent) -> Unit,
    onOpenBatteryGuide: () -> Unit,
) {
    val status = OnboardingStateMachine.status(progress.step, progress, snapshot)
    val act = { onEvent(OnboardingEvent.Act(progress.step)) }
    when (progress.step) {
        OnboardingStep.WELCOME -> {
            Title(R.string.onboarding_welcome_title)
            Body(R.string.onboarding_welcome_body)
            Body(R.string.onboarding_welcome_is)
            Body(R.string.onboarding_welcome_is_not)
        }

        OnboardingStep.DISCLOSURE -> {
            Disclosure(progress, onEvent)
        }

        OnboardingStep.RESTRICTED_SETTINGS -> {
            Title(R.string.onboarding_restricted_title)
            when {
                status == StepStatus.DONE -> {
                    StatusLine(R.string.onboarding_restricted_done, StepStatus.DONE)
                }

                snapshot.restrictedSettings == RestrictedSettings.RESTRICTED -> {
                    StatusLine(
                        R.string.onboarding_restricted_detected,
                        StepStatus.DENIED,
                    )
                }

                else -> {
                    Body(R.string.onboarding_restricted_likely)
                }
            }
            Body(R.string.onboarding_restricted_body)
            Body(R.string.onboarding_restricted_step_try)
            Body(R.string.onboarding_restricted_step_open)
            Body(R.string.onboarding_restricted_step_menu)
            Body(R.string.onboarding_restricted_step_back)
            Caption(R.string.onboarding_restricted_hint)
            Action(R.string.onboarding_restricted_open, act)
        }

        OnboardingStep.NOTIFICATIONS -> {
            Title(R.string.onboarding_notifications_title)
            Body(R.string.onboarding_notifications_body)
            when (status) {
                StepStatus.DONE -> {
                    StatusLine(R.string.onboarding_notifications_done, status)
                }

                StepStatus.DENIED -> {
                    StatusLine(R.string.onboarding_notifications_denied, status)
                    Action(R.string.onboarding_notifications_settings, act)
                }

                StepStatus.TO_DO -> {
                    Action(R.string.onboarding_notifications_allow, act)
                }
            }
        }

        OnboardingStep.ACCESSIBILITY -> {
            Title(R.string.onboarding_accessibility_title)
            Body(R.string.onboarding_accessibility_body)
            when (status) {
                StepStatus.DONE -> {
                    StatusLine(R.string.onboarding_accessibility_done, status)
                }

                StepStatus.DENIED -> {
                    StatusLine(R.string.onboarding_accessibility_denied, status)
                    Action(R.string.onboarding_accessibility_open, act)
                    if (snapshot.restrictedSettings != RestrictedSettings.NOT_APPLICABLE) {
                        MonkiQuietButton(
                            text = stringResource(R.string.onboarding_restricted_open),
                            onClick = { onEvent(OnboardingEvent.Act(OnboardingStep.RESTRICTED_SETTINGS)) },
                            modifier = Modifier.testTag(OnboardingTestTags.RESTRICTED_HELP),
                        )
                    }
                }

                StepStatus.TO_DO -> {
                    Action(R.string.onboarding_accessibility_open, act)
                }
            }
        }

        OnboardingStep.USAGE_ACCESS -> {
            OptionalStep(
                R.string.onboarding_usage_title,
                R.string.onboarding_usage_body,
                status,
                Texts(R.string.onboarding_usage_done, R.string.onboarding_usage_denied, R.string.onboarding_usage_open),
                act,
            )
        }

        OnboardingStep.BATTERY -> {
            OptionalStep(
                R.string.onboarding_battery_title,
                R.string.onboarding_battery_body,
                status,
                Texts(R.string.onboarding_battery_done, R.string.onboarding_battery_denied, R.string.onboarding_battery_allow),
                act,
            )
            Body(StepNames.batterySteps(battery))
            MonkiQuietButton(
                text = stringResource(R.string.onboarding_battery_guide),
                onClick = onOpenBatteryGuide,
                modifier = Modifier.testTag(OnboardingTestTags.BATTERY_GUIDE),
            )
        }

        OnboardingStep.DEVICE_ADMIN -> {
            OptionalStep(
                R.string.onboarding_admin_title,
                R.string.onboarding_admin_body,
                status,
                Texts(R.string.onboarding_admin_done, R.string.onboarding_admin_denied, R.string.onboarding_admin_enable),
                act,
            )
        }

        OnboardingStep.TURN_ON -> {
            TurnOn(progress, snapshot, onEvent)
        }
    }
}

@Composable
private fun Disclosure(
    progress: OnboardingProgress,
    onEvent: (OnboardingEvent) -> Unit,
) {
    DisclosureText()
    if (progress.disclosureAccepted) return
    MonkiInkButton(
        text = stringResource(R.string.onboarding_disclosure_agree),
        onClick = { onEvent(OnboardingEvent.AcceptDisclosure) },
        modifier = Modifier.testTag(OnboardingTestTags.AGREE),
    )
    if (progress.disclosureDeclined) {
        StatusLine(R.string.onboarding_disclosure_declined, StepStatus.DENIED)
        MonkiSecondaryButton(
            text = stringResource(R.string.onboarding_disclosure_stats_only),
            onClick = { onEvent(OnboardingEvent.ContinueStatsOnly) },
            modifier = Modifier.testTag(OnboardingTestTags.STATS_ONLY),
        )
    } else {
        MonkiQuietButton(
            text = stringResource(R.string.onboarding_disclosure_not_now),
            onClick = { onEvent(OnboardingEvent.DeclineDisclosure) },
            modifier = Modifier.testTag(OnboardingTestTags.NOT_NOW),
            muted = true,
        )
    }
    NotNowNote()
}

@Composable
private fun TurnOn(
    progress: OnboardingProgress,
    snapshot: SetupSnapshot,
    onEvent: (OnboardingEvent) -> Unit,
) {
    if (!progress.protects) {
        Title(R.string.onboarding_stats_title)
        Body(R.string.onboarding_stats_body)
        MonkiInkButton(
            text = stringResource(R.string.onboarding_finish),
            onClick = { onEvent(OnboardingEvent.Finish) },
            modifier = Modifier.testTag(OnboardingTestTags.FINISH),
        )
        return
    }
    val missing = OnboardingStateMachine.missing(progress, snapshot)
    Title(R.string.onboarding_turn_on_title)
    if (missing.isEmpty()) {
        Body(R.string.onboarding_turn_on_body)
    } else {
        StatusLine(R.string.onboarding_turn_on_missing, StepStatus.DENIED)
        missing.forEach { step ->
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = stringResource(StepNames.of(step)),
                    color = MonkiTheme.colors.ink1,
                    style = MonkiTheme.typography.body,
                    modifier = Modifier.weight(1f),
                )
                MonkiQuietButton(
                    text = stringResource(R.string.action_fix),
                    onClick = { onEvent(OnboardingEvent.GoTo(step)) },
                    modifier = Modifier.testTag(OnboardingTestTags.fix(step)),
                )
            }
        }
    }
    MonkiInkButton(
        text = stringResource(R.string.home_turn_on),
        onClick = { onEvent(OnboardingEvent.Finish) },
        modifier = Modifier.testTag(OnboardingTestTags.FINISH),
        enabled = missing.isEmpty(),
    )
}

/** The done / denied / action copy of an optional step. */
private data class Texts(
    val done: Int,
    val denied: Int,
    val action: Int,
)

@Composable
private fun OptionalStep(
    title: Int,
    body: Int,
    status: StepStatus,
    texts: Texts,
    act: () -> Unit,
) {
    Title(title)
    Body(body)
    when (status) {
        StepStatus.DONE -> {
            StatusLine(texts.done, status)
        }

        StepStatus.DENIED -> {
            StatusLine(texts.denied, status)
            Action(texts.action, act)
        }

        StepStatus.TO_DO -> {
            Action(texts.action, act)
        }
    }
}

@Composable
private fun Title(text: Int) {
    Text(
        text = stringResource(text),
        color = MonkiTheme.colors.ink1,
        style = MonkiTheme.typography.title,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun Body(text: Int) {
    Text(text = stringResource(text), color = MonkiTheme.colors.ink2, style = MonkiTheme.typography.body)
}

@Composable
private fun Caption(text: Int) {
    Text(text = stringResource(text), color = MonkiTheme.colors.ink3, style = MonkiTheme.typography.caption)
}

/** A step's live status: done in `status-good`, denied in `status-warning`, always with words, never colour alone. */
@Composable
private fun StatusLine(
    text: Int,
    status: StepStatus,
) {
    val color =
        when (status) {
            StepStatus.DONE -> MonkiTheme.colors.statusGood
            StepStatus.DENIED -> MonkiTheme.colors.statusWarning
            StepStatus.TO_DO -> MonkiTheme.colors.ink2
        }
    Column(
        modifier = Modifier.fillMaxWidth().testTag(OnboardingTestTags.STEP_STATUS),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        Text(text = stringResource(text), color = color, style = MonkiTheme.typography.bodyStrong)
    }
}

@Composable
private fun Action(
    text: Int,
    onClick: () -> Unit,
) {
    MonkiInkButton(text = stringResource(text), onClick = onClick, modifier = Modifier.testTag(OnboardingTestTags.ACTION))
}
