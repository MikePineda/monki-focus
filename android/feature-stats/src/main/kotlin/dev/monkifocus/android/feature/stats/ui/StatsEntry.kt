// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/** The way from the Status screen to the statistics. */
@Composable
fun StatsEntry(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    MonkiSecondaryButton(
        text = stringResource(R.string.stats_open),
        onClick = onOpen,
        modifier = modifier.padding(horizontal = MonkiSpacing.spaceMd, vertical = MonkiSpacing.spaceSm).testTag(StatsTestTags.ENTRY),
    )
}
