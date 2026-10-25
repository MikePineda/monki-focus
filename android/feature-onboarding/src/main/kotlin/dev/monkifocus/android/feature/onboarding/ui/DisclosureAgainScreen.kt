// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.R
import dev.monkifocus.android.core.ui.components.MonkiInkButton
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing

/**
 * The disclosure shown again to a user whose protection is on but who never
 * agreed to this version of it (`OnboardingStateMachine.needsReconsent`).
 * Protection stays armed while it shows: "I agree" goes back to Status, and
 * "Not now" leads to Exit and unlink, the one way protection turns off.
 */
@Composable
fun DisclosureAgainScreen(
    onAgree: () -> Unit,
    onNotNow: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize().testTag(OnboardingTestTags.DISCLOSURE_AGAIN), color = MonkiTheme.colors.surface0) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(MonkiSpacing.spaceMd),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier.widthIn(max = MonkiSpacing.columnMax).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceMd),
            ) {
                Text(
                    text = stringResource(R.string.onboarding_disclosure_changed),
                    color = MonkiTheme.colors.statusWarning,
                    style = MonkiTheme.typography.bodyStrong,
                )
                DisclosureText()
                MonkiInkButton(
                    text = stringResource(R.string.onboarding_disclosure_agree),
                    onClick = onAgree,
                    modifier = Modifier.testTag(OnboardingTestTags.AGREE),
                )
                MonkiQuietButton(
                    text = stringResource(R.string.onboarding_disclosure_not_now),
                    onClick = onNotNow,
                    modifier = Modifier.testTag(OnboardingTestTags.NOT_NOW),
                    muted = true,
                )
                NotNowNote()
            }
        }
    }
}
