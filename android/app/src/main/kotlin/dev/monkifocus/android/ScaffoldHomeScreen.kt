// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.components.MonkiSecondaryButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.service.accessibility.ui.NoticeOffBanner
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Placeholder home until onboarding and the Status screen land (work
 * package 2.10). It carries what protection must never lack: the "notice
 * is off" banner while it runs without its notice, the Status line, the
 * request for the notification permission (asked before protection is
 * turned on from here), and "Exit and unlink".
 */
@Composable
fun ScaffoldHomeScreen(
    status: HomeStatus,
    onRequestNotice: () -> Unit,
    onTurnOnProtection: () -> Unit,
    onExitAndUnlink: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            if (status.noticeOffBanner) NoticeOffBanner()
            Box(modifier = Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceLg),
                ) {
                    Text(
                        text = stringResource(CoreUiR.string.home_scaffold_message),
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text =
                            stringResource(
                                if (status.noticePermitted) CoreUiR.string.status_notice_on else CoreUiR.string.status_notice_off,
                            ),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.testTag(HomeTestTags.STATUS_NOTICE),
                    )
                    if (!status.noticePermitted) {
                        MonkiSecondaryButton(
                            text = stringResource(CoreUiR.string.home_notice_request),
                            onClick = onRequestNotice,
                            modifier = Modifier.testTag(HomeTestTags.REQUEST_NOTICE),
                        )
                    }
                    MonkiSecondaryButton(text = stringResource(CoreUiR.string.home_turn_on), onClick = onTurnOnProtection)
                    MonkiQuietButton(text = stringResource(CoreUiR.string.home_exit_button), onClick = onExitAndUnlink)
                }
            }
        }
    }
}
