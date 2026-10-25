// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.rules.Schedule
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.components.MonkiSegmentedControl
import dev.monkifocus.android.core.ui.components.MonkiTextField
import dev.monkifocus.android.core.ui.components.rememberLocalDateTimeText
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.rules.change.RulesMessage
import dev.monkifocus.android.feature.rules.change.RulesState
import dev.monkifocus.android.feature.rules.edit.PendingChanges
import dev.monkifocus.android.feature.rules.edit.RuleSummary
import dev.monkifocus.android.feature.rules.edit.RulesetEdits
import dev.monkifocus.android.feature.rules.edit.SubredditName

/**
 * The rules screen (plan 01 §7, WP 2.10): what waits to apply (with its
 * time and a cancel button), every rule with its target, mode, schedule and
 * budget (mode and switch editable), the allowed reddit communities,
 * bedtime, work hours, and import / export. Every change is a pure edit
 * handed to [RulesActions.onEdit]; nothing here writes the rule set. While
 * [state] is null the rules are loading.
 */
@Composable
fun RulesScreen(
    state: RulesState?,
    message: RulesMessage?,
    actions: RulesActions,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    Surface(modifier = modifier.fillMaxSize().testTag(RulesTestTags.SCREEN), color = colors.surface0) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(MonkiSpacing.spaceMd),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier.widthIn(max = MonkiSpacing.columnMax).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
            ) {
                MonkiQuietButton(
                    text = stringResource(R.string.action_back),
                    onClick = actions.onBack,
                    modifier = Modifier.testTag(RulesTestTags.BACK),
                    muted = true,
                )
                SectionTitle(R.string.rules_title, title = true)
                message?.let {
                    Text(
                        text = RulesText.message(it),
                        color = colors.ink1,
                        style = MonkiTheme.typography.bodyStrong,
                        modifier = Modifier.testTag(RulesTestTags.MESSAGE).semantics { liveRegion = LiveRegionMode.Polite },
                    )
                }
                if (state != null) {
                    PendingSection(state, actions)
                    RuleList(state, actions)
                    Subreddits(state.configured, actions)
                    Bedtime(state.configured, actions)
                    WorkHours(state.configured, actions)
                    Transfer(actions)
                }
            }
        }
    }
}

@Composable
private fun PendingSection(
    state: RulesState,
    actions: RulesActions,
) {
    val pending = state.pending ?: return
    Column(
        modifier = Modifier.fillMaxWidth().testTag(RulesTestTags.PENDING),
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
    ) {
        SectionTitle(R.string.rules_pending_title)
        Body(stringResource(R.string.rules_pending_body, rememberLocalDateTimeText(pending.effectiveFrom)))
        PendingChanges.between(state.effective, pending.ruleset).forEach { Body(RulesText.pendingChange(it)) }
        MonkiSecondaryButton(
            text = stringResource(R.string.rules_pending_cancel),
            onClick = actions.onCancelPending,
            modifier = Modifier.testTag(RulesTestTags.CANCEL_PENDING),
        )
    }
}

@Composable
private fun RuleList(
    state: RulesState,
    actions: RulesActions,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    SectionTitle(R.string.rules_list_title)
    val rows = RuleSummary.rowsOf(state)
    if (rows.isEmpty()) Body(stringResource(R.string.rules_empty))
    val modeLabels = RulesText.MODES.map { stringResource(RulesText.mode(it)) }
    rows.forEach { row ->
        Column(
            modifier = Modifier.fillMaxWidth().testTag(RulesTestTags.rule(row.id)),
            verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = RulesText.target(row.target),
                    color = colors.ink1,
                    style = typography.bodyStrong,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = row.enabled,
                    onCheckedChange = { on -> actions.onEdit { RulesetEdits.setEnabled(it, row.id, on) } },
                    modifier = Modifier.testTag(RulesTestTags.ruleEnabled(row.id)),
                )
            }
            MonkiSegmentedControl(
                labels = modeLabels,
                selectedIndex = RulesText.MODES.indexOf(row.mode).takeIf { it >= 0 },
                onSelect = { index -> actions.onEdit { RulesetEdits.setMode(it, row.id, RulesText.MODES[index]) } },
            )
            val details =
                listOfNotNull(
                    RulesText.schedule(row.schedule),
                    row.dailyBudgetMinutes?.let { stringResource(R.string.rules_budget, it) },
                    if (row.waiting) stringResource(R.string.rules_waiting) else null,
                ).joinToString(" · ")
            Text(text = details, color = colors.ink2, style = typography.bodySm)
        }
        HorizontalDivider(color = colors.line)
    }
}

@Composable
private fun Subreddits(
    configured: Ruleset,
    actions: RulesActions,
) {
    SectionTitle(R.string.rules_subreddits_title)
    Body(stringResource(R.string.rules_subreddits_body))
    val allowed = RulesetEdits.allowedSubreddits(configured)
    if (allowed.isEmpty()) Body(stringResource(R.string.rules_subreddits_empty))
    allowed.forEach { (rule, name) ->
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(text = "r/$name", color = MonkiTheme.colors.ink1, style = MonkiTheme.typography.body, modifier = Modifier.weight(1f))
            MonkiQuietButton(
                text = stringResource(R.string.rules_subreddits_remove, name),
                onClick = { actions.onEdit { RulesetEdits.removeRule(it, rule.id) } },
                modifier = Modifier.testTag(RulesTestTags.subredditRemove(name)),
            )
        }
    }
    var typed by remember { mutableStateOf("") }
    val name = SubredditName.parse(typed)
    val invalid = typed.isNotBlank() && name == null
    val add = {
        if (name != null) {
            actions.onEdit { RulesetEdits.allowSubreddit(it, name) }
            typed = ""
        }
    }
    MonkiTextField(
        value = typed,
        onValueChange = { typed = it },
        label = stringResource(R.string.rules_subreddits_label),
        placeholder = stringResource(R.string.rules_subreddits_placeholder),
        helper = stringResource(if (invalid) R.string.rules_subreddits_invalid else R.string.rules_subreddits_helper),
        counter = "",
        fieldModifier = Modifier.testTag(RulesTestTags.SUBREDDIT_FIELD),
        helperEmphasised = invalid,
        onDone = add,
    )
    MonkiSecondaryButton(
        text = stringResource(R.string.rules_subreddits_add),
        onClick = add,
        modifier = Modifier.testTag(RulesTestTags.SUBREDDIT_ADD),
        enabled = name != null,
    )
}

@Composable
private fun Bedtime(
    configured: Ruleset,
    actions: RulesActions,
) {
    val bedtime = configured.bedtime
    SectionTitle(R.string.rules_bedtime_title)
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = stringResource(R.string.rules_bedtime_enabled),
            color = MonkiTheme.colors.ink1,
            style = MonkiTheme.typography.body,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = bedtime.enabled,
            onCheckedChange = { on -> actions.onEdit { RulesetEdits.setBedtime(it, it.bedtime.copy(enabled = on)) } },
            modifier = Modifier.testTag(RulesTestTags.BEDTIME_ENABLED),
        )
    }
    WindowEditor(
        window = bedtime,
        tags = WindowTags(RulesTestTags.BEDTIME_START, RulesTestTags.BEDTIME_END, RulesTestTags.BEDTIME_SAVE),
        onSave = { draft ->
            actions.onEdit { RulesetEdits.setBedtime(it, it.bedtime.copy(start = draft.start, end = draft.end, days = draft.days)) }
        },
    )
}

@Composable
private fun WorkHours(
    configured: Ruleset,
    actions: RulesActions,
) {
    SectionTitle(R.string.rules_work_title)
    Body(stringResource(R.string.rules_work_body))
    WindowEditor(
        window = configured.workHours,
        tags = WindowTags(RulesTestTags.WORK_START, RulesTestTags.WORK_END, RulesTestTags.WORK_SAVE),
        onSave = { draft -> actions.onEdit { RulesetEdits.setWorkHours(it, Schedule(draft.days, draft.start, draft.end)) } },
    )
}

@Composable
private fun Transfer(actions: RulesActions) {
    SectionTitle(R.string.rules_transfer_title)
    Body(stringResource(R.string.rules_transfer_body))
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd)) {
        MonkiSecondaryButton(
            text = stringResource(R.string.rules_export),
            onClick = actions.onExport,
            modifier = Modifier.weight(1f).testTag(RulesTestTags.EXPORT),
        )
        MonkiSecondaryButton(
            text = stringResource(R.string.rules_import),
            onClick = actions.onImport,
            modifier = Modifier.weight(1f).testTag(RulesTestTags.IMPORT),
        )
    }
}

@Composable
private fun SectionTitle(
    text: Int,
    title: Boolean = false,
) {
    Text(
        text = stringResource(text),
        color = MonkiTheme.colors.ink1,
        style = if (title) MonkiTheme.typography.title else MonkiTheme.typography.heading,
        modifier = Modifier.padding(top = if (title) MonkiSpacing.spaceXs else MonkiSpacing.spaceSm).semantics { heading() },
    )
}

@Composable
private fun Body(text: String) {
    Text(text = text, color = MonkiTheme.colors.ink2, style = MonkiTheme.typography.body)
}
