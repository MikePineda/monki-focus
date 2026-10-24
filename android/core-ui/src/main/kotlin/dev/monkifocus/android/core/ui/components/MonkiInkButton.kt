// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The ink button, primary everywhere except the leave/close action: `ink-1`
 * fill and `surface-0` label, 48 dp ([bottom] makes it 56 dp for the bottom
 * of a screen). Disabled it shows an `ink-3` label on a `line` border, never
 * opacity alone; pair it with a caption that says why.
 */
@Composable
fun MonkiInkButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    bottom: Boolean = false,
) {
    val colors = MonkiTheme.colors
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = if (bottom) MonkiSpacing.tapLg else MonkiSpacing.tap),
        enabled = enabled,
        shape = RoundedCornerShape(MonkiRadius.radiusMd),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = colors.ink1,
                contentColor = colors.surface0,
                disabledContainerColor = Color.Transparent,
                disabledContentColor = colors.ink3,
            ),
        border = if (enabled) null else BorderStroke(1.dp, colors.line),
        contentPadding = PaddingValues(horizontal = MonkiSpacing.spaceMd),
    ) {
        Text(text = text, style = MonkiTheme.typography.bodyStrong)
    }
}
