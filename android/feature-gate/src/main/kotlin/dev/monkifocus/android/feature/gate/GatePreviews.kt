// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.gate

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import dev.monkifocus.android.core.domain.rules.ExplanationKey
import dev.monkifocus.android.core.domain.rules.FrictionType
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.core.ui.theme.MonkiThemeMode
import dev.monkifocus.android.feature.gate.state.GateUiState

// Design previews of every gate screen, light and dark. Synthetic data only.

private const val PREVIEW_TARGET = "example.com"

@Composable
private fun GatePreview(
    state: GateUiState,
    themeMode: MonkiThemeMode = MonkiThemeMode.LIGHT,
) {
    MonkiTheme(themeMode = themeMode) {
        GateScreen(state = state, actions = GateActions(onClose = {}))
    }
}

@Preview(name = "Pausing · countdown", widthDp = 390, heightDp = 844)
@Composable
private fun PausingCountdownPreview() {
    GatePreview(GateUiState.Pausing(PREVIEW_TARGET, level = 1, FrictionType.COUNTDOWN, pauseSeconds = 15, remainingSeconds = 12))
}

@Preview(name = "Pausing · breath · dark", widthDp = 390, heightDp = 844)
@Composable
private fun PausingBreathDarkPreview() {
    GatePreview(
        GateUiState.Pausing(PREVIEW_TARGET, level = 1, FrictionType.BREATH, pauseSeconds = 15, remainingSeconds = 9),
        MonkiThemeMode.DARK,
    )
}

@Preview(name = "Asking · L2", widthDp = 390, heightDp = 844)
@Composable
private fun AskingPreview() {
    GatePreview(GateUiState.Asking(PREVIEW_TARGET, level = 2, requiresTypedIntention = true, requiresGuardianKey = false))
}

@Preview(name = "Blocked · budget", widthDp = 390, heightDp = 844)
@Composable
private fun BlockedPreview() {
    GatePreview(GateUiState.Blocked(PREVIEW_TARGET, ExplanationKey.BUDGET_EXHAUSTED, emergencyAvailable = true))
}

@Preview(name = "Emergency wait · dark", widthDp = 390, heightDp = 844)
@Composable
private fun EmergencyWaitPreview() {
    GatePreview(GateUiState.EmergencyWait(PREVIEW_TARGET, remainingSeconds = 107, guardianLinked = true), MonkiThemeMode.DARK)
}

@Preview(name = "Timeout", widthDp = 390, heightDp = 844)
@Composable
private fun TimeoutPreview() {
    GatePreview(
        GateUiState.Timeout(PREVIEW_TARGET, "reply to one message", minutes = 10, extensionMinutes = 5, nextPauseSeconds = 30),
    )
}

@Preview(name = "Bedtime cover · dark", widthDp = 390, heightDp = 844)
@Composable
private fun BedtimePreview() {
    GatePreview(GateUiState.BedtimeCover(endMinuteOfDay = 420), MonkiThemeMode.DARK)
}
