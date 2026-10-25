// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSegmentedControl

/** Chart or table: every chart has a table with the same numbers (DESIGN.md "Charts"). */
@Composable
internal fun ChartTableToggle(
    showTable: Boolean,
    onShowTable: (Boolean) -> Unit,
    tag: String,
) {
    MonkiSegmentedControl(
        labels = listOf(stringResource(R.string.stats_view_chart), stringResource(R.string.stats_view_table)),
        selectedIndex = if (showTable) 1 else 0,
        onSelect = { onShowTable(it == 1) },
        modifier = Modifier.testTag(StatsTestTags.toggle(tag)),
    )
}
