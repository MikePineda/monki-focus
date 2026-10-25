// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.domain.rules.DailyWindowSpec
import dev.monkifocus.android.core.domain.rules.Weekday
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.components.MonkiTextField
import dev.monkifocus.android.core.ui.components.MonkiToggleChip
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.rules.edit.ClockTime

/**
 * Start, end and days of a weekly window (bedtime, work hours), saved with
 * one button. The times are checked as typed (`HH:MM`, 24-hour); nothing is
 * saved while one is not a time. The draft starts again from [window]
 * whenever the configured window changes.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun WindowEditor(
    window: DailyWindowSpec,
    tags: WindowTags,
    onSave: (WindowDraft) -> Unit,
) {
    var start by remember(window) { mutableStateOf(window.start) }
    var end by remember(window) { mutableStateOf(window.end) }
    var days by remember(window) { mutableStateOf(window.days.toSet()) }
    val startTime = ClockTime.parse(start)
    val endTime = ClockTime.parse(end)
    Column(verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm)) {
        Row(horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd)) {
            TimeField(R.string.rules_start, start, startTime != null, { start = it }, Modifier.weight(1f), tags.start)
            TimeField(R.string.rules_end, end, endTime != null, { end = it }, Modifier.weight(1f), tags.end)
        }
        Text(text = stringResource(R.string.rules_days), color = MonkiTheme.colors.ink2, style = MonkiTheme.typography.label)
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
            verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
        ) {
            Weekday.entries.forEach { day ->
                MonkiToggleChip(
                    label = stringResource(RulesText.day(day)),
                    checked = day in days,
                    onCheckedChange = { on -> days = if (on) days + day else days - day },
                    modifier = Modifier.testTag(RulesTestTags.day(tags.start, day.name.lowercase())),
                )
            }
        }
        MonkiSecondaryButton(
            text = stringResource(R.string.action_save),
            onClick = {
                if (startTime != null && endTime != null) onSave(WindowDraft(startTime, endTime, Weekday.entries.filter { it in days }))
            },
            modifier = Modifier.testTag(tags.save),
            enabled = startTime != null && endTime != null,
        )
    }
}

@Composable
private fun TimeField(
    label: Int,
    value: String,
    valid: Boolean,
    onChange: (String) -> Unit,
    modifier: Modifier,
    tag: String,
) {
    MonkiTextField(
        value = value,
        onValueChange = onChange,
        label = stringResource(label),
        placeholder = stringResource(R.string.rules_time_placeholder),
        helper = stringResource(if (valid) R.string.rules_time_helper else R.string.rules_time_invalid),
        counter = "",
        modifier = modifier,
        fieldModifier = Modifier.testTag(tag),
        helperEmphasised = !valid,
    )
}
