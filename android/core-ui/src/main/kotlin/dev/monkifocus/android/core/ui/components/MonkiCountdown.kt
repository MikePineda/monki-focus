// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.unit.sp
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The big tabular countdown (`countdown` style, `ink-1`): seconds as a bare
 * number plus a muted unit, a minute or more as `m:ss`. Digits never
 * animate. Screen readers get one polite announcement every
 * [CountdownText.ANNOUNCE_EVERY_SECONDS] instead of every tick. [compact]
 * uses the 72 sp size for screens under 600 dp tall.
 */
@Composable
fun MonkiCountdown(
    remainingSeconds: Int,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val colors = MonkiTheme.colors
    val typography = MonkiTheme.typography
    val announcement = rememberCountdownAnnouncement(remainingSeconds)
    val digitsStyle =
        if (compact) {
            typography.countdown.copy(
                fontSize = COMPACT_COUNTDOWN_SIZE,
                lineHeight = COMPACT_COUNTDOWN_SIZE,
            )
        } else {
            typography.countdown
        }
    Row(
        modifier =
            modifier.clearAndSetSemantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = announcement
            },
        horizontalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceXs),
    ) {
        Text(
            text = CountdownText.digits(remainingSeconds),
            modifier = Modifier.alignByBaseline(),
            color = colors.ink1,
            style = digitsStyle,
        )
        if (CountdownText.showsUnit(remainingSeconds)) {
            Text(
                text = stringResource(R.string.countdown_unit_seconds),
                modifier = Modifier.alignByBaseline(),
                color = colors.ink3,
                style = typography.title,
            )
        }
    }
}

/**
 * What a screen reader says for a running countdown. The value only changes
 * when the countdown enters a new [CountdownText.announcementWindow], so a
 * polite live region speaks at most once every five seconds.
 */
@Composable
fun rememberCountdownAnnouncement(remainingSeconds: Int): String {
    val announced = remember(CountdownText.announcementWindow(remainingSeconds)) { remainingSeconds.coerceAtLeast(0) }
    return if (CountdownText.showsUnit(announced)) {
        stringResource(R.string.countdown_announcement_seconds, announced)
    } else {
        stringResource(R.string.countdown_announcement_time, CountdownText.digits(announced))
    }
}

private val COMPACT_COUNTDOWN_SIZE = 72.sp
