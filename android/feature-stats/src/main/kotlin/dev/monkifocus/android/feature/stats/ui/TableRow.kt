// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/** A table row (a label, an optional middle value and a value) with a hairline under it; numbers are tabular. */
@Composable
internal fun TableRow(
    first: String,
    second: String,
    header: Boolean = false,
    third: String? = null,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val style = if (header) typography.label else typography.numeric
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = MonkiSpacing.spaceXs),
        horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
    ) {
        Text(text = first, color = colors.ink1, style = if (header) typography.label else typography.bodySm, modifier = Modifier.weight(1f))
        third?.let { Text(text = it, color = colors.ink2, style = style) }
        Text(text = second, color = colors.ink2, style = style)
    }
    HorizontalDivider(color = colors.line)
}
