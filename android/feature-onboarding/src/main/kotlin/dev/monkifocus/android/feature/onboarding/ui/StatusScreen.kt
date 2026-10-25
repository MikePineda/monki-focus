// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
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
import dev.monkifocus.android.core.ui.components.rememberLocalDateTimeText
import dev.monkifocus.android.core.ui.components.rememberWallClockText
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.status.ActiveRulesSummary
import dev.monkifocus.android.feature.onboarding.status.ChecklistEntry
import dev.monkifocus.android.feature.onboarding.status.ProtectionState

/**
 * The Status screen, the app's home (plan 01 §4, step 8): the protection
 * state, the permission checklist with a fix button on every missing item
 * (a missing required one on top, in `status-critical`), the rules in
 * force, and the ways out and in: "Edit rules", "Turn on protection" when
 * it is not on, and "Exit and unlink", always. [banner] is the "notice is
 * off" banner slot (it belongs to the protection module).
 */
@Composable
fun StatusScreen(
    status: StatusUi,
    onFix: (OnboardingStep) -> Unit,
    onRequestNotice: () -> Unit,
    onTurnOn: () -> Unit,
    onEditRules: () -> Unit,
    onExitAndUnlink: () -> Unit,
    modifier: Modifier = Modifier,
    banner: @Composable () -> Unit = {},
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Surface(modifier = modifier.fillMaxSize().testTag(StatusTestTags.SCREEN), color = colors.surface0) {
        Column(modifier = Modifier.fillMaxSize()) {
            banner()
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(MonkiSpacing.spaceMd),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Column(
                    modifier = Modifier.widthIn(max = MonkiSpacing.columnMax).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
                ) {
                    Text(
                        text = stringResource(R.string.status_title),
                        color = colors.ink1,
                        style = typography.title,
                        modifier = Modifier.semantics { heading() },
                    )
                    Text(
                        text = stringResource(protectionText(status.protection)),
                        color = if (status.protection == ProtectionState.ACTIVE) colors.statusGood else colors.statusWarning,
                        style = typography.bodyStrong,
                        modifier = Modifier.testTag(StatusTestTags.PROTECTION),
                    )
                    Text(
                        text = stringResource(if (status.noticePermitted) R.string.status_notice_on else R.string.status_notice_off),
                        color = colors.ink2,
                        style = typography.body,
                        modifier = Modifier.testTag(StatusTestTags.STATUS_NOTICE),
                    )
                    if (!status.noticePermitted) {
                        MonkiSecondaryButton(
                            text = stringResource(R.string.home_notice_request),
                            onClick = onRequestNotice,
                            modifier = Modifier.testTag(StatusTestTags.REQUEST_NOTICE),
                        )
                    }
                    if (status.protection.canTurnOn) {
                        MonkiInkButton(
                            text = stringResource(R.string.home_turn_on),
                            onClick = onTurnOn,
                            modifier = Modifier.testTag(StatusTestTags.TURN_ON),
                        )
                    }
                    Checklist(status.checklist, onFix)
                    if (status.rulesUnavailable) {
                        Text(
                            text = stringResource(R.string.status_rules_unavailable),
                            color = colors.statusCritical,
                            style = typography.body,
                            modifier = Modifier.testTag(StatusTestTags.RULES_UNAVAILABLE),
                        )
                    } else {
                        status.rules?.let { RulesLine(it) }
                    }
                    MonkiSecondaryButton(
                        text = stringResource(R.string.status_edit_rules),
                        onClick = onEditRules,
                        modifier = Modifier.testTag(StatusTestTags.EDIT_RULES),
                    )
                    MonkiQuietButton(
                        text = stringResource(R.string.home_exit_button),
                        onClick = onExitAndUnlink,
                        modifier = Modifier.testTag(StatusTestTags.EXIT),
                    )
                }
            }
        }
    }
}

@Composable
private fun Checklist(
    entries: List<ChecklistEntry>,
    onFix: (OnboardingStep) -> Unit,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Text(
        text = stringResource(R.string.status_checklist_title),
        color = colors.ink1,
        style = typography.heading,
        modifier = Modifier.semantics { heading() },
    )
    entries.forEach { entry ->
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = MonkiSpacing.rowCompact).testTag(StatusTestTags.item(entry.step)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = stringResource(StepNames.of(entry.step)), color = colors.ink1, style = typography.body)
                Text(
                    text =
                        stringResource(
                            when {
                                entry.granted -> R.string.status_item_on
                                entry.critical -> R.string.status_item_required_off
                                else -> R.string.status_item_off
                            },
                        ),
                    color =
                        when {
                            entry.granted -> colors.statusGood
                            entry.critical -> colors.statusCritical
                            else -> colors.ink3
                        },
                    style = typography.caption,
                )
            }
            if (!entry.granted) {
                MonkiQuietButton(
                    text = stringResource(R.string.action_fix),
                    onClick = { onFix(entry.step) },
                    modifier = Modifier.testTag(StatusTestTags.fix(entry.step)),
                )
            }
        }
        HorizontalDivider(color = colors.line)
    }
}

@Composable
private fun RulesLine(rules: ActiveRulesSummary) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Column(
        modifier = Modifier.fillMaxWidth().testTag(StatusTestTags.RULES),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        Text(
            text = stringResource(R.string.status_rules_title),
            color = colors.ink1,
            style = typography.heading,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = stringResource(R.string.status_rules_count, rules.enabledRules), color = colors.ink2, style = typography.body)
        val start = rules.bedtimeStart
        val end = rules.bedtimeEnd
        Text(
            text =
                if (start != null && end != null) {
                    stringResource(R.string.status_rules_bedtime, rememberWallClockText(start), rememberWallClockText(end))
                } else {
                    stringResource(R.string.status_rules_no_bedtime)
                },
            color = colors.ink2,
            style = typography.body,
        )
        rules.pendingFrom?.let { from ->
            Text(
                text = stringResource(R.string.status_rules_pending, rememberLocalDateTimeText(from)),
                color = colors.ink2,
                style = typography.body,
            )
        }
    }
}

private fun protectionText(state: ProtectionState): Int =
    when (state) {
        ProtectionState.ACTIVE -> R.string.status_protection_active
        ProtectionState.SERVICE_OFF -> R.string.status_protection_service_off
        ProtectionState.EXIT_WAITING -> R.string.status_protection_exit_waiting
        ProtectionState.ENDED -> R.string.status_protection_ended
        ProtectionState.STATS_ONLY -> R.string.status_protection_stats_only
        ProtectionState.SETUP_UNFINISHED -> R.string.status_protection_setup
    }
