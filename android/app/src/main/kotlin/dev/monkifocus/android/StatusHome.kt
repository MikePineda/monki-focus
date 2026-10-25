// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import dev.monkifocus.android.feature.onboarding.flow.OnboardingStep
import dev.monkifocus.android.feature.onboarding.ui.StatusScreen
import dev.monkifocus.android.feature.onboarding.ui.StatusUi
import dev.monkifocus.android.service.accessibility.ui.NoticeOffBanner

/**
 * The home screen: the Status screen with what protection must never lack,
 * the "notice is off" banner while it runs without its notice (plan 04 §2,
 * rule 2), the notice status and its request, and "Exit and unlink".
 */
@Composable
fun StatusHome(
    home: HomeStatus,
    status: StatusUi,
    onFix: (OnboardingStep) -> Unit,
    onRequestNotice: () -> Unit,
    onTurnOn: () -> Unit,
    onEditRules: () -> Unit,
    onExitAndUnlink: () -> Unit,
    modifier: Modifier = Modifier,
) {
    StatusScreen(
        status = status,
        onFix = onFix,
        onRequestNotice = onRequestNotice,
        onTurnOn = onTurnOn,
        onEditRules = onEditRules,
        onExitAndUnlink = onExitAndUnlink,
        modifier = modifier,
        banner = { if (home.noticeOffBanner) NoticeOffBanner() },
    )
}
