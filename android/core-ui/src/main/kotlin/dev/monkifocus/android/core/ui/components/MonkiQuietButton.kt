// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The quiet text button for inline actions: underlined text in `accent`, or
 * in `ink-2` when [muted] (the "Emergency access" footer), with a 44 dp hit
 * area.
 */
@Composable
fun MonkiQuietButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    muted: Boolean = false,
) {
    val colors = MonkiTheme.colors
    TextButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = MonkiSpacing.tapMin),
        colors = ButtonDefaults.textButtonColors(contentColor = if (muted) colors.ink2 else colors.accent),
    ) {
        Text(
            text = text,
            style = MonkiTheme.typography.bodySm.copy(textDecoration = TextDecoration.Underline),
        )
    }
}
