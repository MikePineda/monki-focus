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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import dev.monkifocus.android.core.ui.components.MonkiQuietButton
import dev.monkifocus.android.core.ui.theme.MonkiSpacing
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Placeholder home until onboarding and the Status screen land (work
 * package 2.10). "Exit and unlink" is always reachable from here.
 */
@Composable
fun ScaffoldHomeScreen(
    onExitAndUnlink: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize()) {
        Box(modifier = Modifier.safeDrawingPadding(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(MonkiSpacing.spaceLg)) {
                Text(
                    text = stringResource(CoreUiR.string.home_scaffold_message),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                )
                MonkiQuietButton(text = stringResource(CoreUiR.string.home_exit_button), onClick = onExitAndUnlink)
            }
        }
    }
}
