// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
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
 * A chip that is on or off (weekdays of a schedule): 44 dp tall, `accent`
 * text and border on `accent-soft` when on, `ink-1` on `surface-2` when off.
 * It is a checkbox for accessibility, so the state is announced, never
 * shown by colour alone.
 */
@Composable
fun MonkiToggleChip(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val shape = RoundedCornerShape(MonkiRadius.radiusSm)
    val look =
        if (checked) {
            Modifier.background(colors.accentSoft, shape).border(1.dp, colors.accent, shape)
        } else {
            Modifier.background(colors.surface2, shape).border(1.dp, colors.line, shape)
        }
    Box(
        modifier =
            modifier
                .heightIn(min = MonkiSpacing.tapMin)
                .clip(shape)
                .then(look)
                .toggleable(value = checked, onValueChange = onCheckedChange, role = Role.Checkbox)
                .padding(horizontal = MonkiSpacing.spaceSm),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, color = if (checked) colors.accent else colors.ink1, style = MonkiTheme.typography.label)
    }
}
