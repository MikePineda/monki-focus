// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The secondary button, the alternative that costs something ("Continue to
 * …", "5 more min", "Cancel emergency"): transparent, 1 dp `line-strong`
 * border, `ink-1` label, 48 dp. Disabled: `ink-3` label on a `line` border.
 */
@Composable
fun MonkiSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = MonkiTheme.colors
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = MonkiSpacing.tap),
        enabled = enabled,
        shape = RoundedCornerShape(MonkiRadius.radiusMd),
        colors =
            ButtonDefaults.outlinedButtonColors(
                containerColor = Color.Transparent,
                contentColor = colors.ink1,
                disabledContainerColor = Color.Transparent,
                disabledContentColor = colors.ink3,
            ),
        border = BorderStroke(1.dp, if (enabled) colors.lineStrong else colors.line),
        contentPadding = PaddingValues(horizontal = MonkiSpacing.spaceMd),
    ) {
        Text(text = text, style = MonkiTheme.typography.bodyStrong)
    }
}
