// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme

/**
 * The 1 dp pause progress line: `line` track, `ink-1` fill, square ends,
 * never the accent. [progress] (0…1) comes from the stored end time; the
 * fill glides linearly between ticks, or jumps under reduced motion.
 */
@Composable
fun MonkiProgressLine(
    progress: Float,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val target = progress.coerceIn(0f, 1f)
    val shown by animateFloatAsState(
        targetValue = target,
        animationSpec = if (MonkiTheme.reducedMotion) snap() else tween(durationMillis = TICK_MS, easing = LinearEasing),
        label = "progress",
    )
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.line)
                .semantics { progressBarRangeInfo = ProgressBarRangeInfo(target, 0f..1f) },
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(shown)
                    .background(colors.ink1),
        )
    }
}

/** One countdown tick: the line moves continuously across each second. */
private const val TICK_MS = 1000
