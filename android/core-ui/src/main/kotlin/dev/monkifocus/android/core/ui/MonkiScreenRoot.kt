// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * The root of every full-screen app screen. Android 15+ draws the app edge
 * to edge, so this paints the bars' area in `surface-0` and pads the content
 * by [insets] (by default the status bar, the navigation bar, the display
 * cutout and the keyboard). The padding consumes those insets, so a screen
 * that pads itself again (`safeDrawingPadding`, `statusBarsPadding`) adds
 * nothing, and a scrolling screen ends above the navigation bar.
 */
@Composable
fun MonkiScreenRoot(
    modifier: Modifier = Modifier,
    insets: WindowInsets = WindowInsets.safeDrawing,
    content: @Composable () -> Unit,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(MonkiTheme.colors.surface0)
                .windowInsetsPadding(insets),
    ) {
        content()
    }
}
