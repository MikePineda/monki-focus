// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.rememberCountdownAnnouncement
import dev.monkifocus.android.core.ui.theme.MonkiMotion
import dev.monkifocus.android.core.ui.theme.MonkiRadius
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The breath pause (DESIGN.md, Countdown and Motion): a 160 dp frame with a
 * 1 dp outlined circle that grows for 4 s and shrinks for 4 s, the
 * alternating "Breathe in" / "Breathe out" label and the rhythm line. The
 * phase follows the elapsed time, so it never drifts from the stored end
 * time. Under reduced motion the circle stays still while the label still
 * alternates. The frame is a polite live region like the countdown.
 */
@Composable
internal fun BreathPause(
    elapsedSeconds: Int,
    remainingSeconds: Int,
    modifier: Modifier = Modifier,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val phaseSeconds = MonkiMotion.BREATH_PHASE_MS / MILLIS_PER_SECOND
    val inhaling = (elapsedSeconds / phaseSeconds) % 2 == 0
    val reducedMotion = MonkiTheme.reducedMotion
    val scale by animateFloatAsState(
        targetValue = if (reducedMotion || inhaling) EXPANDED else CONTRACTED,
        animationSpec =
            if (reducedMotion) {
                snap()
            } else {
                tween(
                    durationMillis = MonkiMotion.BREATH_PHASE_MS,
                    easing = MonkiMotion.easingStandard,
                )
            },
        label = "breath",
    )
    val announcement = rememberCountdownAnnouncement(remainingSeconds)
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceSm),
    ) {
        Box(
            modifier =
                Modifier
                    .size(FRAME_SIZE)
                    .background(colors.surface2, RoundedCornerShape(MonkiRadius.radiusLg))
                    .testTag(GateTestTags.BREATH)
                    .clearAndSetSemantics {
                        liveRegion = LiveRegionMode.Polite
                        contentDescription = announcement
                    },
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize(CIRCLE_FRACTION)
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        }.border(1.dp, colors.ink1, CircleShape),
            )
        }
        Text(
            text = stringResource(if (inhaling) R.string.gate_breathe_in else R.string.gate_breathe_out),
            color = colors.ink1,
            style = typography.title,
        )
        Text(
            text = stringResource(R.string.gate_breath_rhythm, phaseSeconds, remainingSeconds.coerceAtLeast(0)),
            color = colors.ink3,
            style = typography.label,
        )
    }
}

private const val MILLIS_PER_SECOND = 1000
private const val EXPANDED = 1f
private const val CONTRACTED = 0.6f
private const val CIRCLE_FRACTION = 0.9f
private val FRAME_SIZE = 160.dp
