// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The leave/close button: the one accent fill on a screen, 56 dp, full
 * column width. It has no `enabled` parameter on purpose: leaving is always
 * possible, from the first frame.
 */
@Composable
fun MonkiCloseButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = MonkiSpacing.tapLg),
        shape = RoundedCornerShape(MonkiRadius.radiusMd),
        colors =
            ButtonDefaults.buttonColors(
                containerColor = if (pressed) colors.accentHover else colors.accent,
                contentColor = colors.accentInk,
            ),
        contentPadding = PaddingValues(horizontal = MonkiSpacing.spaceMd),
        interactionSource = interactionSource,
    ) {
        Text(text = text, style = MonkiTheme.typography.bodyStrong)
    }
}
