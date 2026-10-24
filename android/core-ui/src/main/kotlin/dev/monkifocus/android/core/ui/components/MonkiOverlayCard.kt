// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The overlay card (the timeout card): at most 480 dp wide, 32 dp padding,
 * `surface-1` with a `line` border, radius 12, centred over the `scrim`
 * (solid colour with alpha, never blur). It scrolls when large text makes it
 * taller than the screen. [paneTitle] names the dialog for accessibility
 * services.
 */
@Composable
fun MonkiOverlayCard(
    paneTitle: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MonkiTheme.colors
    val shape = RoundedCornerShape(MonkiRadius.radiusLg)
    Box(
        modifier = modifier.fillMaxSize().background(colors.scrim).padding(MonkiSpacing.spaceMd),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = CARD_MAX_WIDTH)
                    .fillMaxWidth()
                    .background(colors.surface1, shape)
                    .border(1.dp, colors.line, shape)
                    .verticalScroll(rememberScrollState())
                    .padding(MonkiSpacing.spaceXl)
                    .semantics { this.paneTitle = paneTitle },
            verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
            content = content,
        )
    }
}

private val CARD_MAX_WIDTH = 480.dp
