// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiCloseButton
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The gate column (DESIGN.md, Interstitial): full screen `surface-0`, one
 * centred column of at most 560 dp, nothing from the visited app. The
 * content gets `compact` on screens under 600 dp tall (smaller countdown).
 */
@Composable
internal fun GateLayout(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.(compact: Boolean) -> Unit,
) {
    BoxWithConstraints(
        modifier = modifier.fillMaxSize().background(MonkiTheme.colors.surface0).safeDrawingPadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        val compact = maxHeight < COMPACT_HEIGHT
        Column(
            modifier =
                Modifier
                    .widthIn(max = MonkiSpacing.columnMax)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(
                        horizontal = MonkiSpacing.spaceMd,
                        vertical = if (compact) MonkiSpacing.spaceLg else MonkiSpacing.space3xl,
                    ),
            verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceLg),
        ) {
            content(compact)
        }
    }
}

/**
 * Close: the one accent control, enabled from the first frame and focused
 * first. [label] is "Close" by default and "Leave" on the timeout card.
 */
@Composable
internal fun GateCloseButton(
    onClose: () -> Unit,
    label: String = stringResource(R.string.action_close),
) {
    val focusRequester = remember { FocusRequester() }
    MonkiCloseButton(
        text = label,
        onClick = onClose,
        modifier = Modifier.focusRequester(focusRequester).testTag(GateTestTags.CLOSE),
    )
    LaunchedEffect(focusRequester) {
        focusRequester.requestFocus()
    }
}

/** The muted context line: what is being opened. */
@Composable
internal fun GateContextLine(targetLabel: String) {
    Text(text = targetLabel, color = MonkiTheme.colors.ink3, style = MonkiTheme.typography.label)
}

/** "Level 2 of 3", neutral. */
@Composable
internal fun GateLevelLine(level: Int) {
    Text(
        text = stringResource(R.string.gate_level, level, MAX_LEVEL),
        color = MonkiTheme.colors.ink3,
        style = MonkiTheme.typography.caption,
    )
}

/** The footer's quiet "Emergency access" action. */
@Composable
internal fun GateEmergencyFooter(onEmergency: () -> Unit) {
    MonkiQuietButton(
        text = stringResource(R.string.gate_emergency),
        onClick = onEmergency,
        modifier = Modifier.testTag(GateTestTags.EMERGENCY),
        muted = true,
    )
}

/** The highest gate level (SEMANTICS.md §7.1). */
private const val MAX_LEVEL = 3

private val COMPACT_HEIGHT = 600.dp
