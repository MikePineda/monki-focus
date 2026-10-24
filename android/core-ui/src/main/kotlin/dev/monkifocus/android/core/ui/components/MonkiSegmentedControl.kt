// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * A segmented control (a radio group): `surface-2` track with 4 dp padding,
 * 40 dp options, 48 dp overall. The selected option has `accent` text and a
 * 1 dp `accent` border on `accent-soft`. [selectedIndex] may be null and has
 * no default: for the 5/10/15 duration picker, choosing is the commitment.
 */
@Composable
fun MonkiSegmentedControl(
    labels: List<String>,
    selectedIndex: Int?,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val trackShape = RoundedCornerShape(MonkiRadius.radiusMd)
    val optionShape = RoundedCornerShape(MonkiRadius.radiusSm)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .height(MonkiSpacing.tap)
                .clip(trackShape)
                .background(colors.surface2)
                .padding(MonkiSpacing.spaceXs)
                .selectableGroup(),
        horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        labels.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            val selection =
                if (selected) {
                    Modifier.background(colors.accentSoft, optionShape).border(1.dp, colors.accent, optionShape)
                } else {
                    Modifier
                }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(MonkiSpacing.tap - MonkiSpacing.spaceXs * 2)
                        .clip(optionShape)
                        .then(selection)
                        .selectable(selected = selected, onClick = { onSelect(index) }, role = Role.RadioButton),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    color = if (selected) colors.accent else colors.ink1,
                    style = MonkiTheme.typography.label,
                )
            }
        }
    }
}
