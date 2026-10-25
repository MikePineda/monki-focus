// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.feature.stats.model.StatsScreenState

/**
 * Local statistics (plan §2.11), reached from the Status screen: today's
 * focus pulse, today by level, the top apps and sites, today's intentions,
 * the last seven days and the hour × weekday heatmap. Every chart has a
 * text legend and a table view. Empty states: no usage access (explanation
 * and fix) and no data yet.
 */
@Composable
fun StatsScreen(
    state: StatsScreenState,
    onBack: () -> Unit,
    onFixUsageAccess: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    Surface(modifier = modifier.fillMaxSize().testTag(StatsTestTags.SCREEN), color = colors.surface0) {
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
                MonkiQuietButton(
                    text = stringResource(R.string.action_back),
                    onClick = onBack,
                    modifier = Modifier.testTag(StatsTestTags.BACK),
                )
                Text(
                    text = stringResource(R.string.stats_title),
                    color = colors.ink1,
                    style = typography.title,
                    modifier = Modifier.semantics { heading() },
                )
                when (state) {
                    StatsScreenState.Loading -> {
                        Text(text = stringResource(R.string.stats_loading), color = colors.ink2, style = typography.body)
                    }

                    StatsScreenState.Failed -> {
                        Text(
                            text = stringResource(R.string.stats_failed),
                            color = colors.statusCritical,
                            style = typography.body,
                            modifier = Modifier.testTag(StatsTestTags.FAILED),
                        )
                        MonkiSecondaryButton(
                            text = stringResource(R.string.stats_retry),
                            onClick = onRetry,
                            modifier = Modifier.testTag(StatsTestTags.RETRY),
                        )
                    }

                    StatsScreenState.NoUsageAccess -> {
                        UsageAccessNotice(compact = false, onFix = onFixUsageAccess)
                    }

                    StatsScreenState.NoDataYet -> {
                        Text(
                            text = stringResource(R.string.stats_empty),
                            color = colors.ink2,
                            style = typography.body,
                            modifier = Modifier.testTag(StatsTestTags.EMPTY),
                        )
                    }

                    is StatsScreenState.Ready -> {
                        if (state.usageAccessMissing) UsageAccessNotice(compact = true, onFix = onFixUsageAccess)
                        PulseHeadline(state.today)
                        LevelBarSection(state.today)
                        HorizontalDivider(color = colors.line)
                        TopActivitiesSection(state.today)
                        IntentionsSection(state.today.intentions)
                        HorizontalDivider(color = colors.line)
                        WeekSection(state.week)
                        HeatmapSection(state.week)
                    }
                }
            }
        }
    }
}
